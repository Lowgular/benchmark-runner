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

# mcpServers frontmatter → .mcp.json + .claude/settings.json (auto-approval).
# Done by a helper in the harness tree so `yaml` resolves from harness
# node_modules (inline `bun -e` resolves from the run dir and fails).
bun run "$SCRIPT_DIR/extract-mcp.ts" "$RUN_DIR"

if [ -f AGENTS.md ]; then
  # Recipe body → CLAUDE.md (frontmatter stripped — tools/mcpServers are
  # harness wiring consumed by framework.ts/this adapter, not instructions).
  awk 'f{print} /^---$/{c++; if(c==2) f=1}' AGENTS.md > CLAUDE.md
  rm AGENTS.md
fi

# Skills → SDK discovery path.
if [ -d skills ]; then
  rm -rf .claude/skills
  mv skills .claude/skills
fi

echo "[workspace-setup:anthropic-sdk] mounted CLAUDE.md + .mcp.json + .claude/{settings.json,skills}"
