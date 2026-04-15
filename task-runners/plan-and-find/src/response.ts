import { isAIMessage } from "@langchain/core/messages";
import { BaseMessage } from "langchain";

/** OpenRouter usage object nested under AIMessage.response_metadata */
type OpenRouterTokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  cost?: number;
};

export type OpenRouterUsageSummary = {
  generations: number;
  promptTokens: number;
  completionTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  costUsd: number;
};

function readOpenRouterTokenUsage(
  msg: BaseMessage,
): OpenRouterTokenUsage | undefined {
  if (!isAIMessage(msg)) return undefined;
  const meta = msg.response_metadata as Record<string, unknown> | undefined;
  const raw = meta?.tokenUsage;
  if (!raw || typeof raw !== "object") return undefined;
  return raw as OpenRouterTokenUsage;
}

function readThinkingTokens(msg: BaseMessage, usage: OpenRouterTokenUsage): number {
  const direct = usage.completion_tokens_details?.reasoning_tokens;
  if (typeof direct === "number") return direct;

  const usageMetadata = (msg as BaseMessage & { usage_metadata?: unknown })
    .usage_metadata as Record<string, unknown> | undefined;
  const outputDetails = usageMetadata?.output_token_details as
    | Record<string, unknown>
    | undefined;
  const reasoning = outputDetails?.reasoning;
  if (typeof reasoning === "number") return reasoning;

  return 0;
}

/** Sums usage across each model generation (each AIMessage with tokenUsage). */
function summarizeOpenRouterUsage(
  messages: BaseMessage[],
): OpenRouterUsageSummary {
  let promptTokens = 0;
  let completionTokens = 0;
  let thinkingTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;
  let generations = 0;

  for (const msg of messages) {
    const tu = readOpenRouterTokenUsage(msg);
    if (tu == null) continue;
    generations += 1;
    promptTokens += tu.prompt_tokens ?? 0;
    completionTokens += tu.completion_tokens ?? 0;
    thinkingTokens += readThinkingTokens(msg, tu);
    totalTokens +=
      tu.total_tokens ?? (tu.prompt_tokens ?? 0) + (tu.completion_tokens ?? 0);
    costUsd += typeof tu.cost === "number" ? tu.cost : 0;
  }

  return {
    generations,
    promptTokens,
    completionTokens,
    thinkingTokens,
    totalTokens,
    costUsd,
  };
}

export type RunnerUsageSummary = {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  cost: number;
};

export function buildOpenRouterUsageFromAgentResult(result: {
  messages: BaseMessage[];
}): OpenRouterUsageSummary {
  return summarizeOpenRouterUsage(result.messages);
}

export function buildRunnerUsageSummary(
  usage: OpenRouterUsageSummary,
): RunnerUsageSummary {
  return {
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
    thinkingTokens: usage.thinkingTokens,
    totalTokens: usage.totalTokens,
    cost: usage.costUsd,
  };
}

export function logOpenRouterUsage(usage: OpenRouterUsageSummary) {
  if (usage.generations === 0) {
    console.log(
      "Usage: no AIMessage with response_metadata.tokenUsage (e.g. non-OpenRouter or missing metadata).",
    );
    return;
  }
  console.log(
    `Usage (${usage.generations} generation(s)): output tokens ${usage.completionTokens}, ` +
      `prompt tokens ${usage.promptTokens}, thinking tokens ${
        usage.thinkingTokens
      }, total tokens ${usage.totalTokens}, cost $${usage.costUsd.toFixed(6)}`,
  );
}
