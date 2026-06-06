#!/usr/bin/env bash
# Anthropic-sdk workspace adapter — mounts the neutral agent layout in
# Claude-native conventions. Invoked by run_task.sh AFTER the three overlay
# layers (init-state → agent → task), with the run dir as $1 (and cwd).
#
# Neutral form (what the agent folder ships):   Claude-native mount:
#   AGENTS.md  (recipe: frontmatter + body)  →    CLAUDE.md (body only — auto-
#                                                 loaded as project memory;
#                                                 verified: AGENTS.md is NOT
#                                                 auto-loaded by the bundled CLI)
#   skills/<name>/SKILL.md                   →    .claude/skills/<name>/SKILL.md
#                                                 (discovered via settingSources
#                                                 ["project"] + skills "all")
#
# Harnesses without this script get the neutral layout as-is; their plugins
# inject the recipe body as a system prompt instead (framework default).
set -euo pipefail

RUN_DIR="${1:?usage: workspace-setup.sh <run-dir>}"
cd "$RUN_DIR"

# Recipe → CLAUDE.md, frontmatter stripped (tools/mcpServers are harness
# wiring consumed by framework.ts, not agent instructions).
if [ -f AGENTS.md ]; then
  awk 'f{print} /^---$/{c++; if(c==2) f=1}' AGENTS.md > CLAUDE.md
  rm AGENTS.md
fi

# Skills → SDK discovery path.
if [ -d skills ]; then
  mkdir -p .claude
  rm -rf .claude/skills
  mv skills .claude/skills
fi

echo "[workspace-setup:anthropic-sdk] mounted CLAUDE.md + .claude/skills"
