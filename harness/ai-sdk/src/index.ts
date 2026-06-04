/**
 * AI SDK harness — runs via Vercel AI SDK using OpenRouter as the model provider.
 * MCP servers are spawned via @modelcontextprotocol/sdk and exposed as AI SDK tools.
 *
 * Yields standardized Message events; framework writes agent.jsonl + RESPONSE.md.
 *
 * Requires: OPENROUTER_API_KEY env var.
 */
import { streamText, tool, jsonSchema, stepCountIs, type ToolSet } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { HarnessParams, Message, Usage } from "../../framework.ts";

const MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.5",
  "claude-opus-4-7": "anthropic/claude-opus-4.5",
};

function resolveOpenRouterModel(model: string): string {
  return MODEL_MAP[model] ?? model;
}

interface McpToolset {
  tools: ToolSet;
  close: () => Promise<void>;
}

async function buildMcpTools(
  mcpServers: HarnessParams["mcpServers"],
): Promise<McpToolset> {
  const clients: Client[] = [];
  const tools: ToolSet = {};

  for (const [serverName, cfg] of Object.entries(mcpServers)) {
    if (cfg.type !== "stdio" || !cfg.command) continue;
    const transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args ?? [],
      env: cfg.env,
    });
    const client = new Client({ name: `harness-${serverName}`, version: "0.0.1" });
    await client.connect(transport);
    clients.push(client);

    const listed = await client.listTools();
    for (const t of listed.tools) {
      const toolKey = `${serverName}__${t.name}`;
      tools[toolKey] = tool({
        description: t.description ?? "",
        inputSchema: jsonSchema(t.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: async (args: unknown) => {
          const result = await client.callTool({
            name: t.name,
            arguments: args as Record<string, unknown>,
          });
          return result.content;
        },
      });
    }
  }

  return {
    tools,
    close: async () => {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
    },
  };
}

export async function* run(params: HarnessParams): AsyncGenerator<Message> {
  yield { t: "user", text: params.task };

  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    yield { t: "error", message: "OPENROUTER_API_KEY env var not set" };
    yield {
      t: "result",
      status: "error",
      turnCount: 0,
      totalUsage: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
      model: params.model,
    };
    return;
  }

  const openrouter = createOpenRouter({ apiKey });
  const toolset = await buildMcpTools(params.mcpServers);

  let turn = 0;
  let assistantBuffer = "";
  let thinkingBuffer = "";
  const totalUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let status: "completed" | "error" = "completed";

  try {
    const result = streamText({
      model: openrouter(resolveOpenRouterModel(params.model)),
      system: params.systemPrompt,
      prompt: params.task,
      tools: toolset.tools,
      stopWhen: stepCountIs(50),
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          assistantBuffer += part.text;
          break;
        case "reasoning-delta":
          thinkingBuffer += part.text;
          break;
        case "tool-call":
          yield {
            t: "tool_use",
            turn: turn + 1,
            id: part.toolCallId,
            name: part.toolName,
            input: part.input,
          };
          break;
        case "tool-result":
          yield {
            t: "tool_result",
            turn: turn + 1,
            toolUseId: part.toolCallId,
            isError: false,
            content:
              typeof part.output === "string"
                ? part.output
                : JSON.stringify(part.output),
          };
          break;
        case "tool-error":
          yield {
            t: "tool_result",
            turn: turn + 1,
            toolUseId: part.toolCallId,
            isError: true,
            content: String((part as { error: unknown }).error),
          };
          break;
        case "finish-step": {
          turn++;
          if (thinkingBuffer.trim()) {
            yield { t: "thinking", turn, text: thinkingBuffer };
            thinkingBuffer = "";
          }
          const u = part.usage;
          const stepUsage: Usage = {
            input: Number(u.inputTokens ?? 0),
            output: Number(u.outputTokens ?? 0),
            cacheRead: Number(u.cachedInputTokens ?? 0),
            cacheCreate: 0,
          };
          totalUsage.input += stepUsage.input;
          totalUsage.output += stepUsage.output;
          totalUsage.cacheRead += stepUsage.cacheRead;
          if (assistantBuffer.trim()) {
            yield {
              t: "assistant",
              turn,
              text: assistantBuffer,
              usage: stepUsage,
            };
            assistantBuffer = "";
          }
          break;
        }
        case "error":
          status = "error";
          yield {
            t: "error",
            message: part.error instanceof Error ? part.error.message : String(part.error),
          };
          break;
      }
    }
  } catch (err) {
    status = "error";
    yield {
      t: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await toolset.close();
  }

  yield {
    t: "result",
    status,
    turnCount: turn,
    totalUsage,
    model: params.model,
  };
}
