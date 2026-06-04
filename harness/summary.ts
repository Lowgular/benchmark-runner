/**
 * Shared summary.json builder — the single source of truth for the
 * WCS-compatible Pass-1 shape (results[0].score = null until Pass-2 eval).
 *
 * Consumed by:
 *   - framework.ts     (writes summary.json from the result event it streamed)
 *   - write-summary.ts (standalone regen tool for existing agent.jsonl traces)
 */
import type { Usage } from "./framework.ts";

export interface ResultEvent {
  t: "result";
  status: "completed" | "error";
  turnCount: number;
  totalUsage: Usage;
  model?: string;
  costUsd?: number;
}

export interface SummaryInput {
  taskId: string;
  prompt: string;
  taskRunId: string;
  environmentId: string;
  /** Fallback model id when the result event carries none. */
  model: string;
  pipelineId: string;
  harnessId: string;
  elapsedMs: number;
  startedAt: string;
  result: ResultEvent | null;
}

export function buildSummary(input: SummaryInput): Record<string, unknown> {
  const { result } = input;
  return {
    version: "1",
    results: [
      {
        promptDef: { name: input.taskId, prompt: input.prompt },
        score: null,
      },
    ],
    details: {
      summary: {
        taskId: input.taskId,
        prompt: input.prompt,
        taskRunId: input.taskRunId,
        environmentId: input.environmentId,
        model: result?.model ?? input.model,
        pipelineId: input.pipelineId,
        runner: { id: input.harnessId },
        elapsedMs: input.elapsedMs,
        timestamp: input.startedAt,
        ...(result
          ? {
              status: result.status,
              turnCount: result.turnCount,
              usage: result.totalUsage,
              ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
            }
          : { status: "unknown" }),
      },
    },
  };
}
