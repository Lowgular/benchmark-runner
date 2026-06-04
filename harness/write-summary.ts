#!/usr/bin/env bun
/**
 * Standalone regen tool: rebuilds summary.json for an EXISTING run dir from
 * its agent.jsonl trace. Normal runs don't need this — framework.ts writes
 * summary.json itself (pass --run-id/--init-state). Use this only to
 * re-generate summaries for historical runs.
 *
 * Inputs (all required, passed as flags):
 *   --cwd <path>            run workdir
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

import { buildSummary, type ResultEvent } from "./summary.ts";

interface Args {
  cwd: string;
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
  // Task overlays place the brief at tasks/<task>/<task>.md (VRT) or tasks/<task>.md.
  const candidates = [join(cwd, "tasks", task, `${task}.md`), join(cwd, "tasks", `${task}.md`)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  }
  console.warn(
    `[write-summary] task file not found at ${candidates.join(" or ")} — prompt will be empty`,
  );
  return "";
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

  const summary = buildSummary({
    taskId: args.task,
    prompt: readTaskFile(args.cwd, args.task),
    taskRunId: args.taskRunId,
    environmentId: parse(args.initState).name,
    model: args.model,
    pipelineId: readAgentName(args.agentFile),
    harnessId: args.harnessId,
    elapsedMs: args.elapsedMs,
    startedAt: args.startedAt,
    result: readLastResult(join(args.cwd, "agent.jsonl")),
  });

  const outPath = join(args.cwd, "summary.json");
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.error(`[write-summary] wrote ${outPath}`);
}

main();
