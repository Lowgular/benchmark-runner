#!/usr/bin/env bash
set -e

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <folder-name>"
  echo "  folder-name must match the task dir (e.g. angular.image-src-binding.attr-src-binding) and is used as --prompt-filter"
  exit 1
fi

FOLDER="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/${FOLDER}"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Error: folder not found: $PROJECT_DIR"
  exit 1
fi

# Edit this list to match the models you want to run
MODELS=(
# arcee-ai/trinity-large-preview:free
# nvidia/nemotron-3-nano-30b-a3b:free
# qwen/qwen3-coder-next
# mistralai/codestral-2508
# deepseek/deepseek-v3.2
# google/gemini-2.5-flash
# google/gemini-2.5-flash-lite
# minimax/minimax-m2.5
# z-ai/glm-4.7
# openai/gpt-4.1-mini
# openai/gpt-5-mini
# openai/gpt-5.1-codex-mini
# openai/gpt-4o-mini
# x-ai/grok-4.1-fast
# x-ai/grok-code-fast-1
# qwen/qwen3-235b-a22b-thinking-2507

# minimax/minimax-m2.1
# mistralai/devstral-2512
# qwen/qwen3-next-80b-a3b-instruct
# meta-llama/llama-3.3-70b-instruct

# openai/gpt-4.1-nano
# openai/gpt-5-nano
# qwen/qwen3-coder
qwen/qwen3-coder-30b-a3b-instruct
# z-ai/glm-4.6
# z-ai/glm-4.7-flash
)

cd "$PROJECT_DIR"

for MODEL in "${MODELS[@]}"; do
  echo "========== Running for model: $MODEL =========="
  rm -rf .web-codegen-scorer && DEBUG=1 web-codegen-scorer eval \
    --env ../../../environments/refactor-angular-entry/config.js \
    --logging text-only \
    --skip-screenshots true \
    --skip-axe-testing true \
    --enable-auto-csp false \
    --enable-user-journey-testing false \
    --skip-ai-summary true \
    --skip-lighthouse true \
    --runner ai-sdk \
    --prompt-filter "$FOLDER" \
    --model "$MODEL"

  echo "========== Pushing with lga for model: $MODEL =========="
  lga push
done

echo "========== All models done =========="