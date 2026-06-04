#!/usr/bin/env bun
/**
 * Writes summary.json into the run workdir after the harness exits.
 *
 * Inputs (all required, passed as flags by run_task.sh):
 *   --cwd <path>            run workdir
 *   --bench <name>          e.g. "vrt"
 *   --task <name>           e.g. "pricing"
 *   --task-run-id <guid>
 *   --model <resolved>      e.g. "claude-opus-4-7"
 *   --agent-file <path>     agent.md (frontmatter: name → pipelineId)
 *   --init-state <path>     init-state dir (basename → environmentId)
 *   --harness-id <name>     e.g. "anthropic-sdk" (WCS-compatible: aisdk, genkit, claudecode, …)
 *   --elapsed-ms <int>      wall-clock around the harness call
 *   --started-at <iso>      ISO timestamp for run start
 *
 * Reads <cwd>/agent.jsonl, finds the last { t: "result" } line, and pulls
 * turnCount / totalUsage / costUsd from it. Writes <cwd>/summary.json with the
 * WCS-compatible shape (results[0].score = null for Pass 1).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";

interface Args {
  cwd: string;
  bench: string;
  task: string;
  taskRunId: string;
  model: string;
  agentFile: string;
  initState: string;
  harnessId: string;
  elapsedMs: number;
  startedAt: string;
}

function parseArgs(argv: string[]): Args {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith("--") || val === undefined) {
      throw new Error(`Bad CLI args at position ${i}: ${key} ${val}`);
    }
    opts[key.slice(2)] = val;
  }
  const need = (k: string) => {
    const v = opts[k];
    if (!v) throw new Error(`Missing --${k}`);
    return v;
  };
  return {
    cwd: need("cwd"),
    bench: need("bench"),
    task: need("task"),
    taskRunId: need("task-run-id"),
    model: need("model"),
    agentFile: need("agent-file"),
    initState: need("init-state"),
    harnessId: need("harness-id"),
    elapsedMs: Number(need("elapsed-ms")),
    startedAt: need("started-at"),
  };
}

function readAgentName(agentFile: string): string {
  const content = readFileSync(agentFile, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return /^name:\s*(.+)$/m.exec(fm?.[1] ?? "")?.[1]?.trim() ?? "";
}

function readTaskFile(cwd: string, task: string): string {
  const candidate = join(cwd, "tasks", `${task}.md`);
  if (!existsSync(candidate)) {
    console.warn(`[write-summary] task file not found at ${candidate} — prompt will be empty`);
    return "";
  }
  return readFileSync(candidate, "utf8");
}

interface ResultEvent {
  t: "result";
  status: "completed" | "error";
  turnCount: number;
  totalUsage: { input: number; output: number; cacheRead: number; cacheCreate: number };
  model?: string;
  costUsd?: number;
}

function readLastResult(tracePath: string): ResultEvent | null {
  if (!existsSync(tracePath)) return null;
  const lines = readFileSync(tracePath, "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as { t?: string };
      if (parsed.t === "result") return parsed as ResultEvent;
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const pipelineId = readAgentName(args.agentFile);
  const prompt = readTaskFile(args.cwd, args.task);
  const environmentId = parse(args.initState).name;
  const tracePath = join(args.cwd, "agent.jsonl");
  const result = readLastResult(tracePath);

  const summary = {
    version: "1",
    results: [
      {
        promptDef: { name: args.task, prompt },
        score: null,
      },
    ],
    details: {
      summary: {
        taskId: args.task,
        prompt,
        taskRunId: args.taskRunId,
        environmentId,
        model: result?.model ?? args.model,
        pipelineId,
        runner: { id: args.harnessId },
        elapsedMs: args.elapsedMs,
        timestamp: args.startedAt,
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

  const outPath = join(args.cwd, "summary.json");
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.error(`[write-summary] wrote ${outPath}`);
}

main();
