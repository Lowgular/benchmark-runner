/**
 * Anthropic SDK harness. Pure async generator — no CLI, no file I/O.
 * The framework wraps this and handles agent.jsonl, RESPONSE.md, logging.
 *
 * Yields Message events in real time as the SDK stream produces them, and
 * a final `result` event with totals at the end.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

import type { HarnessParams, Message, Usage } from "../../framework.ts";

function normalizeUsage(u: Record<string, unknown> | undefined): Usage {
  return {
    input: Number(u?.["input_tokens"] ?? 0),
    output: Number(u?.["output_tokens"] ?? 0),
    cacheRead: Number(u?.["cache_read_input_tokens"] ?? 0),
    cacheCreate: Number(u?.["cache_creation_input_tokens"] ?? 0),
  };
}

function stringifyToolResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const cb = c as Record<string, unknown>;
        return cb["type"] === "text" ? String(cb["text"] ?? "") : `[${cb["type"]}]`;
      })
      .join("\n");
  }
  return String(content ?? "");
}

export async function* run(params: HarnessParams): AsyncGenerator<Message> {
  yield { t: "user", text: params.task };

  const stream = query({
    prompt: params.task,
    options: {
      cwd: params.cwd,
      systemPrompt: params.systemPrompt,
      model: params.model,
      permissionMode: "bypassPermissions",
      allowedTools: params.allowedTools,
      mcpServers: params.mcpServers as Record<
        string,
        { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
      >,
    },
  });

  let turn = 0;
  const totalUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let status: "completed" | "error" = "completed";
  let costUsd: number | undefined;

  for await (const sdkMsg of stream) {
    if (sdkMsg.type === "assistant") {
      turn++;
      const message = (sdkMsg as unknown as {
        message: { content: unknown; usage?: Record<string, unknown> };
      }).message;
      const usage = normalizeUsage(message.usage);
      totalUsage.input += usage.input;
      totalUsage.output += usage.output;
      totalUsage.cacheRead += usage.cacheRead;
      totalUsage.cacheCreate += usage.cacheCreate;

      if (!Array.isArray(message.content)) continue;

      let assistantText = "";
      for (const block of message.content as Array<Record<string, unknown>>) {
        const type = String(block["type"] ?? "");
        if (type === "text") {
          assistantText = String(block["text"] ?? "");
        } else if (type === "thinking") {
          yield { t: "thinking", turn, text: String(block["thinking"] ?? "") };
        } else if (type === "tool_use") {
          yield {
            t: "tool_use",
            turn,
            id: String(block["id"] ?? ""),
            name: String(block["name"] ?? ""),
            input: block["input"],
          };
        }
      }
      if (assistantText.trim()) {
        yield { t: "assistant", turn, text: assistantText, usage };
      }
    } else if (sdkMsg.type === "user") {
      const content = (sdkMsg as { message?: { content?: unknown } }).message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content as Array<Record<string, unknown>>) {
        if (block["type"] !== "tool_result") continue;
        yield {
          t: "tool_result",
          turn,
          toolUseId: String(block["tool_use_id"] ?? ""),
          isError: Boolean(block["is_error"]),
          content: stringifyToolResultContent(block["content"]),
        };
      }
    } else if (sdkMsg.type === "result") {
      const r = sdkMsg as { subtype?: string; total_cost_usd?: number };
      status = r.subtype === "success" ? "completed" : "error";
      if (typeof r.total_cost_usd === "number") costUsd = r.total_cost_usd;
    }
  }

  yield {
    t: "result",
    status,
    turnCount: turn,
    totalUsage,
    model: params.model,
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}
