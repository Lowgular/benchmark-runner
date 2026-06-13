/**
 * AGENTS.md parsing — shared between framework.ts (the run's top-level agent)
 * and pipeline-mode harness modules (per-node sub-agents). Lives in its own
 * module so harness code can value-import it without breaking the
 * "framework.ts imports must be type-only" contract rule.
 */
import { readFileSync } from "node:fs";

import { parse as parseYaml } from "yaml";

import type { McpServerConfig } from "./framework.ts";

export interface AgentDef {
  name: string;
  description: string;
  tools: string[];
  mcpServers: Record<string, McpServerConfig>;
  /** Optional model alias/id for this agent — pipeline nodes default to the run model when absent. */
  model?: string;
  /** Optional per-query turn ceiling — pipeline nodes default to the harness constant when absent. */
  maxTurns?: number;
  body: string;
}

export function parseAgentFile(filePath: string): AgentDef {
  const content = readFileSync(filePath, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) throw new Error(`No YAML frontmatter found in ${filePath}`);
  const [, frontmatterStr = "", body = ""] = fm;
  const frontmatter = (parseYaml(frontmatterStr) ?? {}) as Record<string, unknown>;
  const tools = Array.isArray(frontmatter["tools"])
    ? (frontmatter["tools"] as unknown[]).map(String)
    : [];
  const mcpServers =
    (frontmatter["mcpServers"] as Record<string, McpServerConfig> | undefined) ?? {};
  const model = frontmatter["model"] != null ? String(frontmatter["model"]) : undefined;
  const maxTurnsRaw = Number(frontmatter["maxTurns"]);
  return {
    name: String(frontmatter["name"] ?? ""),
    description: String(frontmatter["description"] ?? ""),
    tools,
    mcpServers,
    ...(model ? { model } : {}),
    ...(Number.isFinite(maxTurnsRaw) && maxTurnsRaw > 0 ? { maxTurns: maxTurnsRaw } : {}),
    body: body.trim(),
  };
}
