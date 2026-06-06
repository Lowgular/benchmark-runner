/**
 * DeepAgents harness — runs via the `deepagents` package's createDeepAgent,
 * with OpenRouter as the model provider (via @langchain/openai's OpenAI-compatible
 * client pointed at OpenRouter's API).
 *
 * Native mounts (deepagents conventions, mirroring the anthropic-sdk adapter
 * philosophy — "as close to native as possible"):
 *   - recipe body  → `memory: ["/AGENTS.md"]` (deepagents' documented AGENTS.md
 *     memory mechanism; file ships via run_task.sh layer 2, frontmatter stripped
 *     by workspace-setup.sh)
 *   - skills/      → `skills: ["/skills/"]` (SkillsMiddleware; passed only when
 *     the recipe declares skills — params.skills is the framework-enumerated list)
 *   - filesystem   → LocalShellBackend rooted at the run dir (virtual POSIX "/")
 *
 * MCP servers wire in via @langchain/mcp-adapters as extra tools.
 *
 * Yields standardized Message events; framework writes agent.jsonl + RESPONSE.md.
 *
 * Requires: OPENROUTER_API_KEY (declared via requiredEnv, delivered in params.secrets).
 * NOTE: engine migrated createReactAgent → createDeepAgent 2026-06-05; typechecked
 * but not yet exercised in a paid run (OpenRouter stage).
 */
import { createDeepAgent, LocalShellBackend } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { HarnessParams, Message, Usage } from "../../framework.ts";
import { toOpenRouterModel } from "../../models.ts";

export const requiredEnv = ["OPENROUTER_API_KEY"] as const;

/** Mirror of the anthropic-sdk MAX_TURNS=150 backstop. One agent turn is two
 * graph steps (model → tools), so the recursion ceiling is 2× turns. */
const MAX_RECURSION = 300;

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

  const apiKey = params.secrets["OPENROUTER_API_KEY"];
  if (!apiKey) {
    yield { t: "error", message: "OPENROUTER_API_KEY missing from params.secrets" };
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
    model: toOpenRouterModel(params.model),
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
  const mcpTools = mcpClient ? await mcpClient.getTools() : [];

  // LocalShellBackend: virtual POSIX "/" = the run dir. File/shell tools come
  // from the backend (deepagents-native), MCP tools are appended.
  const backend = await LocalShellBackend.create({
    rootDir: params.cwd,
    virtualMode: true,
    inheritEnv: true,
  });

  const agent = createDeepAgent({
    model: llm,
    tools: mcpTools,
    backend,
    // Recipe body, deepagents-native: loaded at startup into the system prompt.
    memory: ["/AGENTS.md"],
    // Recipe-declared skills only (framework-enumerated) — mirrors the
    // anthropic-sdk exact-list rule so harness surfaces stay comparable.
    ...(params.skills.length > 0 ? { skills: ["/skills/"] } : {}),
  });

  let turn = 0;
  const totalUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let status: "completed" | "error" = "completed";

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(params.task)] },
      { streamMode: "updates", recursionLimit: MAX_RECURSION },
    );

    for await (const update of stream) {
      // createDeepAgent's graph node names differ from createReactAgent's
      // ("agent"/"tools"); classify by message TYPE instead — robust across
      // engine internals.
      for (const nodeOutput of Object.values(update as Record<string, unknown>)) {
        const messages = (nodeOutput as { messages?: BaseMessage[] } | undefined)?.messages;
        if (!messages) continue;

        for (const msg of messages) {
          if (msg instanceof AIMessage) {
            turn++;
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
          } else if (msg instanceof ToolMessage) {
            yield {
              t: "tool_result",
              turn,
              toolUseId: msg.tool_call_id,
              isError: msg.status === "error",
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
