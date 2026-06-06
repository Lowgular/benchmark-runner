#!/usr/bin/env bun
/**
 * Workspace-adapter helper: extracts the `mcpServers` block from the run dir's
 * AGENTS.md frontmatter and writes Claude Code's native project config:
 *   - <run-dir>/.mcp.json                  (project MCP standard)
 *   - <run-dir>/.claude/settings.json      (enableAllProjectMcpServers, merged)
 *
 * Lives in the harness tree so `yaml` resolves from harness/node_modules —
 * the same parser framework.ts uses (single source of truth for the dialect).
 * Invoked by workspace-setup.sh; runnable standalone for testing:
 *   bun run harness/anthropic-sdk/extract-mcp.ts <run-dir>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

const runDir = process.argv[2];
if (!runDir) {
  console.error("usage: extract-mcp.ts <run-dir>");
  process.exit(1);
}

const agentsPath = join(runDir, "AGENTS.md");
if (existsSync(agentsPath)) {
  const content = readFileSync(agentsPath, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const frontmatter = fm ? ((parseYaml(fm[1] ?? "") ?? {}) as Record<string, unknown>) : {};
  const servers = (frontmatter["mcpServers"] as Record<string, unknown> | undefined) ?? {};
  if (Object.keys(servers).length > 0) {
    writeFileSync(
      join(runDir, ".mcp.json"),
      JSON.stringify({ mcpServers: servers }, null, 2) + "\n",
    );
    console.log(
      `[extract-mcp] wrote .mcp.json (${Object.keys(servers).join(", ")})`,
    );
  }
}

// Project MCP servers need approval; headless runs opt in via settings.
// Merge into any settings.json shipped by earlier layers rather than clobbering.
const settingsDir = join(runDir, ".claude");
mkdirSync(settingsDir, { recursive: true });
const settingsPath = join(settingsDir, "settings.json");
const settings = existsSync(settingsPath)
  ? (JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>)
  : {};
settings["enableAllProjectMcpServers"] = true;
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
