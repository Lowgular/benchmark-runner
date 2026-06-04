/**
 * Single source of truth for model naming across the harness pipeline.
 *
 *   alias ("sonnet")  →  canonical Anthropic id ("claude-sonnet-4-6")
 *   canonical id      →  OpenRouter slug ("anthropic/claude-sonnet-4.6")
 *
 * framework.ts resolves aliases; OpenRouter-backed harness plugins map the
 * canonical id to the OpenRouter slug. Keep both tables here — a mislabeled
 * model silently corrupts every benchmark comparison.
 */

export const MODEL_ALIASES: Record<string, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

export function resolveModel(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
}

/** Canonical Anthropic id → OpenRouter slug (verified against openrouter.ai). */
export const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
  "claude-opus-4-7": "anthropic/claude-opus-4.7",
};

export function toOpenRouterModel(model: string): string {
  return OPENROUTER_MODEL_MAP[model] ?? model;
}
