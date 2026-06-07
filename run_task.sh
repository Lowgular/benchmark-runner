#!/usr/bin/env bash
# Usage: ./run_task.sh <bench> <task> <model> [--harness=<name>] [extra-args...]
# Example:
#   ./run_task.sh vrt pricing opus                                # anthropic-sdk (default)
#   ./run_task.sh vrt pricing opus --harness=ai-sdk               # via OpenRouter
#   ./run_task.sh vrt pricing sonnet --harness=deepagents         # via OpenRouter + langgraph
#
# Creates a fresh GUID-named workdir under runs/<bench>/<task>/, prepares it
# (rsync init-state → npm install → overlay task), and invokes the chosen
# harness via framework.ts, which writes agent.jsonl + RESPONSE.md +
# summary.json (Pass-1: run metadata + usage, score=null).
# A separate eval step amplifies summary.json with results[0].score later.
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <bench> <task> <model> [--harness=<name>] [extra-args...]"
  echo "Example: $0 vrt pricing opus --harness=anthropic-sdk"
  exit 1
fi

BENCH="$1"
TASK="$2"
MODEL="$3"
shift 3

# Default harness, overridable via --harness=NAME flag anywhere after positional args.
HARNESS_ID="anthropic-sdk"
EXTRA_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --harness=*) HARNESS_ID="${arg#--harness=}" ;;
    *)           EXTRA_ARGS+=("$arg") ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$BENCH" in
  vrt)
    INIT_STATE="$ROOT/init-states/angular-20-storybook"
    AGENT="$ROOT/agents/vrt/AGENTS.md"
    ;;
  *)
    echo "Unknown bench: $BENCH (supported: vrt)" >&2
    exit 1
    ;;
esac

if [ ! -d "$ROOT/harness/$HARNESS_ID/src" ]; then
  echo "Unknown harness: $HARNESS_ID (looked for harness/$HARNESS_ID/src/index.ts)" >&2
  exit 1
fi

FRAMEWORK="$ROOT/harness/framework.ts"

# Preflight: fail fast on missing API keys BEFORE the expensive workspace setup.
bun run "$FRAMEWORK" --harness "$HARNESS_ID" --check-env

TASK_DIR="$ROOT/tasks/$BENCH/$TASK"
if [ ! -d "$TASK_DIR" ]; then
  echo "Task dir not found: $TASK_DIR" >&2
  exit 1
fi

GUID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
RUN_DIR="$ROOT/runs/$BENCH/$TASK/$GUID"
mkdir -p "$RUN_DIR"

echo "[run_task] bench=$BENCH task=$TASK model=$MODEL harness=$HARNESS_ID"
echo "[run_task] run dir: $RUN_DIR"
echo ""

cd "$RUN_DIR"

# Workspace composition — three NEUTRAL overlays, later layers win conflicts:
#   1. init-state  (neutral environment: scaffold, verifiers, tokens)
#   2. agent       (vendor-neutral recipe image: AGENTS.md + skills/ + anything else)
#   3. task        (the exam: brief, baselines, manifests, per-task overrides)
# Then the selected harness may adapt the neutral layout to its native
# conventions via an optional harness/<id>/workspace-setup.sh (e.g. the
# anthropic-sdk adapter mounts AGENTS.md as CLAUDE.md and skills/ as
# .claude/skills/). No adapter = neutral layout as-is.
echo "[setup] layer 1/3: init-state ${INIT_STATE} (excludes from .gitignore)…"
rsync -a --checksum --filter=":- .gitignore" "$INIT_STATE/" "$RUN_DIR/"

AGENT_DIR="$(dirname "$AGENT")"
echo "[setup] layer 2/3: agent ${AGENT_DIR}…"
rsync -a --checksum "$AGENT_DIR/" "$RUN_DIR/"

echo "[setup] layer 3/3: task ${TASK_DIR}…"
rsync -a --checksum "$TASK_DIR/" "$RUN_DIR/"

WORKSPACE_SETUP="$ROOT/harness/$HARNESS_ID/workspace-setup.sh"
if [ -x "$WORKSPACE_SETUP" ]; then
  echo "[setup] harness workspace adapter: ${WORKSPACE_SETUP}…"
  "$WORKSPACE_SETUP" "$RUN_DIR"
fi

echo "[setup] running npm ci…"
npm ci --no-audit --no-fund

echo ""

TASK_FILE="$TASK_DIR/tasks/$TASK.md"

bun run "$FRAMEWORK" \
  --harness "$HARNESS_ID" \
  --agent "$AGENT" \
  --task "$TASK_FILE" \
  --model "$MODEL" \
  --run-id "$GUID" \
  --init-state "$INIT_STATE" \
  --verbose "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"

echo ""
echo "[run_task] done. Score it (Pass-2): ./score_run.sh $RUN_DIR"
