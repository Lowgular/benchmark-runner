#!/usr/bin/env bash
# DeepAgents workspace adapter. The neutral layout is already deepagents-native:
#   AGENTS.md  → loaded via createDeepAgent `memory: ["/AGENTS.md"]` (its
#                documented AGENTS.md memory mechanism)
#   skills/    → loaded via `skills: ["/skills/"]` (SkillsMiddleware)
# The only adaptation needed: strip the YAML frontmatter from AGENTS.md in
# place — tools/mcpServers are harness wiring consumed by framework.ts, not
# agent instructions, and deepagents loads the file verbatim into the prompt.
set -euo pipefail

RUN_DIR="${1:?usage: workspace-setup.sh <run-dir>}"
cd "$RUN_DIR"

if [ -f AGENTS.md ] && head -1 AGENTS.md | grep -q '^---$'; then
  awk 'f{print} /^---$/{c++; if(c==2) f=1}' AGENTS.md > AGENTS.md.tmp
  mv AGENTS.md.tmp AGENTS.md
fi

echo "[workspace-setup:deepagents] AGENTS.md frontmatter stripped (native memory + skills mounts)"
