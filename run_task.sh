#!/usr/bin/env bash
# Usage: ./run_task.sh <bench> <task> <model> [--harness=<name>] [extra-args...]
# Example:
#   ./run_task.sh vrt pricing opus                                # anthropic-sdk (default)
#   ./run_task.sh vrt pricing opus --harness=ai-sdk               # via OpenRouter
#   ./run_task.sh vrt pricing sonnet --harness=deepagents         # via OpenRouter + langgraph
#
# Creates a fresh GUID-named workdir under runs/<bench>/<task>/, prepares it
# (rsync init-state → npm install → overlay task), invokes the chosen harness,
# and writes summary.json (Pass-1: run metadata + usage from agent.jsonl, score=null).
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

echo "[setup] syncing init-state into cwd (excludes from .gitignore)…"
rsync -a --checksum --filter=":- .gitignore" "$INIT_STATE/" "$RUN_DIR/"

echo "[setup] running npm install…"
npm install --no-audit --no-fund

echo "[setup] overlaying task files from ${TASK_DIR}…"
rsync -a --checksum "$TASK_DIR/" "$RUN_DIR/"

echo ""

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_S=$(date +%s)

TASK_FILE="$TASK_DIR/tasks/$TASK.md"

set +e
bun run "$FRAMEWORK" \
  --harness "$HARNESS_ID" \
  --agent "$AGENT" \
  --task "$TASK_FILE" \
  --model "$MODEL" \
  --verbose "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
HARNESS_EXIT=$?
set -e

END_S=$(date +%s)
ELAPSED_MS=$(( (END_S - START_S) * 1000 ))

echo ""
bun run "$ROOT/harness/write-summary.ts" \
  --cwd "$RUN_DIR" \
  --bench "$BENCH" \
  --task "$TASK" \
  --task-run-id "$GUID" \
  --model "$MODEL" \
  --agent-file "$AGENT" \
  --init-state "$INIT_STATE" \
  --harness-id "$HARNESS_ID" \
  --elapsed-ms "$ELAPSED_MS" \
  --started-at "$STARTED_AT"

exit "$HARNESS_EXIT"
