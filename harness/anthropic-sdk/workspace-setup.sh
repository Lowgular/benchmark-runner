#!/usr/bin/env bash
# Anthropic-sdk workspace adapter — mounts the neutral agent layout in
# Claude-native conventions. Invoked by run_task.sh AFTER the three overlay
# layers (init-state → agent → task), with the run dir as $1 (and cwd).
#
# Neutral form (what the agent folder ships):   Claude-native mount:
#   AGENTS.md frontmatter: mcpServers        →    .mcp.json (project MCP standard)
#                                                 + .claude/settings.json
#                                                 (enableAllProjectMcpServers)
#   AGENTS.md body                            →    CLAUDE.md (auto-loaded project
#                                                 memory; verified: AGENTS.md is
#                                                 NOT auto-loaded by the CLI)
#   skills/<name>/SKILL.md                    →    .claude/skills/<name>/SKILL.md
#                                                 (settingSources ["project"]
#                                                 + skills "all")
#
# NOT moved: the frontmatter `tools` allowlist stays programmatic in the plugin
# (query allowedTools) — it is a sandbox boundary (blocks WebSearch/WebFetch),
# and settings.json permissions cannot restrict under bypassPermissions.
#
# Harnesses without this script get the neutral layout as-is; their plugins
# inject the recipe body as a system prompt instead (framework default).
set -euo pipefail

RUN_DIR="${1:?usage: workspace-setup.sh <run-dir>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$RUN_DIR"

if [ -f AGENTS.md ]; then
  # mcpServers frontmatter → .mcp.json (Claude Code's project MCP standard).
  # Parsed with the same yaml package framework.ts uses (single source of truth
  # for the frontmatter dialect).
  bun -e '
    import { readFileSync, writeFileSync } from "node:fs";
    import { parse } from "'"$ROOT"'/harness/node_modules/yaml/dist/index.mjs";
    const content = readFileSync("AGENTS.md", "utf8");
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    const y = fm ? parse(fm[1]) ?? {} : {};
    const servers = y.mcpServers ?? {};
    if (Object.keys(servers).length > 0) {
      writeFileSync(".mcp.json", JSON.stringify({ mcpServers: servers }, null, 2) + "\n");
      console.log("[workspace-setup:anthropic-sdk] wrote .mcp.json (" + Object.keys(servers).join(", ") + ")");
    }
  '

  # Recipe body → CLAUDE.md (frontmatter stripped — tools/mcpServers are
  # harness wiring consumed by framework.ts/this adapter, not instructions).
  awk 'f{print} /^---$/{c++; if(c==2) f=1}' AGENTS.md > CLAUDE.md
  rm AGENTS.md
fi

# Project MCP servers need approval; headless runs opt in via settings.
# Merge into any settings.json shipped by earlier layers rather than clobbering.
mkdir -p .claude
bun -e '
  import { readFileSync, writeFileSync, existsSync } from "node:fs";
  const p = ".claude/settings.json";
  const cur = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  cur.enableAllProjectMcpServers = true;
  writeFileSync(p, JSON.stringify(cur, null, 2) + "\n");
'

# Skills → SDK discovery path.
if [ -d skills ]; then
  rm -rf .claude/skills
  mv skills .claude/skills
fi

echo "[workspace-setup:anthropic-sdk] mounted CLAUDE.md + .mcp.json + .claude/{settings.json,skills}"
