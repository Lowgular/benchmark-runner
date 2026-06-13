/**
 * Small translation helpers shared by the single-agent loop (index.ts) and
 * pipeline mode (pipeline.ts) — SDK stream payloads → standard Message parts.
 */
import type { Usage } from "../../framework.ts";

export function normalizeUsage(u: Record<string, unknown> | undefined): Usage {
  return {
    input: Number(u?.["input_tokens"] ?? 0),
    output: Number(u?.["output_tokens"] ?? 0),
    cacheRead: Number(u?.["cache_read_input_tokens"] ?? 0),
    cacheCreate: Number(u?.["cache_creation_input_tokens"] ?? 0),
  };
}

export function zeroUsage(): Usage {
  return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
}

export function addUsage(into: Usage, add: Usage): void {
  into.input += add.input;
  into.output += add.output;
  into.cacheRead += add.cacheRead;
  into.cacheCreate += add.cacheCreate;
}

export function stringifyToolResultContent(content: unknown): string {
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
