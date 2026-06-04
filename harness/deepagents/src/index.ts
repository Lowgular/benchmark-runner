/**
 * DeepAgents-style harness — runs via LangChain JS + LangGraph's createReactAgent,
 * with OpenRouter as the model provider (via @langchain/openai's OpenAI-compatible
 * client pointed at OpenRouter's API).
 *
 * MCP servers wire in via @langchain/mcp-adapters. Tools are passed to the react agent.
 *
 * Yields standardized Message events; framework writes agent.jsonl + RESPONSE.md.
 *
 * Requires: OPENROUTER_API_KEY env var.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { HarnessParams, Message, Usage } from "../../framework.ts";

const MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.5",
  "claude-opus-4-7": "anthropic/claude-opus-4.5",
};

function resolveOpenRouterModel(model: string): string {
  return MODEL_MAP[model] ?? model;
}

function extractText(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content
    .map((c) => {
      const cb = c as Record<string, unknown>;
      return cb["type"] === "text" ? String(cb["text"] ?? "") : "";
    })
    .filter(Boolean)
    .join("");
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

  const llm = new ChatOpenAI({
    model: resolveOpenRouterModel(params.model),
    apiKey,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    streamUsage: true,
  });

  // Build MCP client config (stdio servers only for now)
  const mcpConnections: Record<string, {
    transport: "stdio";
    command: string;
    args: string[];
    env?: Record<string, string>;
  }> = {};
  for (const [name, cfg] of Object.entries(params.mcpServers)) {
    if (cfg.type === "stdio" && cfg.command) {
      mcpConnections[name] = {
        transport: "stdio",
        command: cfg.command,
        args: cfg.args ?? [],
        ...(cfg.env ? { env: cfg.env } : {}),
      };
    }
  }

  const hasMcp = Object.keys(mcpConnections).length > 0;
  const mcpClient = hasMcp ? new MultiServerMCPClient({ mcpServers: mcpConnections }) : null;
  const tools = mcpClient ? await mcpClient.getTools() : [];

  const agent = createReactAgent({
    llm,
    tools,
    prompt: params.systemPrompt,
  });

  let turn = 0;
  const totalUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let status: "completed" | "error" = "completed";

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(params.task)] },
      { streamMode: "updates", recursionLimit: 50 },
    );

    for await (const update of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(update)) {
        const messages = (nodeOutput as { messages?: BaseMessage[] } | undefined)?.messages;
        if (!messages) continue;

        if (nodeName === "agent") {
          turn++;
          for (const msg of messages) {
            if (!(msg instanceof AIMessage)) continue;

            const usageMeta = (msg as unknown as {
              usage_metadata?: {
                input_tokens?: number;
                output_tokens?: number;
                input_token_details?: { cache_read?: number; cache_creation?: number };
              };
            }).usage_metadata ?? {};
            const usage: Usage = {
              input: Number(usageMeta.input_tokens ?? 0),
              output: Number(usageMeta.output_tokens ?? 0),
              cacheRead: Number(usageMeta.input_token_details?.cache_read ?? 0),
              cacheCreate: Number(usageMeta.input_token_details?.cache_creation ?? 0),
            };
            totalUsage.input += usage.input;
            totalUsage.output += usage.output;
            totalUsage.cacheRead += usage.cacheRead;
            totalUsage.cacheCreate += usage.cacheCreate;

            const text = extractText(msg.content);
            if (text.trim()) {
              yield { t: "assistant", turn, text, usage };
            }

            const toolCalls = (msg as unknown as {
              tool_calls?: Array<{ id?: string; name: string; args: unknown }>;
            }).tool_calls ?? [];
            for (const tc of toolCalls) {
              yield {
                t: "tool_use",
                turn,
                id: tc.id ?? "",
                name: tc.name,
                input: tc.args,
              };
            }
          }
        } else if (nodeName === "tools") {
          for (const msg of messages) {
            if (!(msg instanceof ToolMessage)) continue;
            yield {
              t: "tool_result",
              turn,
              toolUseId: msg.tool_call_id,
              isError: false,
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            };
          }
        }
      }
    }
  } catch (err) {
    status = "error";
    yield {
      t: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (mcpClient) await mcpClient.close().catch(() => {});
  }

  yield {
    t: "result",
    status,
    turnCount: turn,
    totalUsage,
    model: params.model,
  };
}
