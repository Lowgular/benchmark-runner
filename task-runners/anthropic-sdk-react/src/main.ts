#!/usr/bin/env bun
/**
 * Visual-regression task runner.
 *
 * Reads a task brief + 3 baseline PNGs, copies them into a fresh working
 * copy of the init-state, runs the agent (claude-agent-sdk ReAct loop),
 * then persists the run output.
 *
 *   bun run src/main.ts <task-file> <init-state-dir> <agent-file> <model>
 *
 *   task-file        path to tasks/vrt/<slug>.md
 *                    (sibling dir tasks/vrt/<slug>/ holds the 3 PNGs)
 *   init-state-dir   path to init-states/<env>/ (will be copied per run)
 *   agent-file       path to task-runners/<runner>/agents/<agent>.md
 *   model            haiku | sonnet | opus | <full model id>
 *
 *   Outputs go to runs/<runner>/<task>/<run-id>/.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(RUNNER_DIR, "..", "..");
const RUNS_ROOT = resolve(REPO_ROOT, "runs");
const RUNNER_NAME = parse(RUNNER_DIR).name;

const MODEL_ALIASES: Record<string, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

function resolveModel(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
}

interface AgentDef {
  name: string;
  description: string;
  tools: string[];
  body: string;
}

function parseAgentFile(filePath: string): AgentDef {
  const content = readFileSync(filePath, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) throw new Error(`No YAML frontmatter found in ${filePath}`);
  const [, frontmatter = "", body = ""] = fm;
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? "";
  const description =
    /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? "";
  const toolsBlock = /^tools:\s*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m.exec(
    frontmatter,
  );
  const tools = toolsBlock?.[1]
    ? toolsBlock[1]
        .split(/\r?\n/)
        .map((l: string) => l.replace(/^[ \t]+-[ \t]+/, "").trim())
        .filter(Boolean)
    : [];
  return { name, description, tools, body: body.trim() };
}

function parseCliArgs(): {
  taskFile: string;
  initStateDir: string;
  agentFile: string;
  modelName: string;
} {
  const [, , taskFile, initStateDir, agentFile, modelName] = process.argv;
  const missing: string[] = [];
  if (!taskFile) missing.push("task-file");
  if (!initStateDir) missing.push("init-state-dir");
  if (!agentFile) missing.push("agent-file");
  if (!modelName) missing.push("model-name");
  if (missing.length) {
    console.error(`Missing args: ${missing.join(", ")}`);
    console.error(
      "Usage: bun run src/main.ts <task-file> <init-state-dir> <agent-file> <model-name>",
    );
    process.exit(1);
  }
  return {
    taskFile: taskFile!,
    initStateDir: initStateDir!,
    agentFile: agentFile!,
    modelName: modelName!,
  };
}

const HEAVY_DIRS = new Set([
  "node_modules",
  "storybook-static",
  ".bench",
  ".angular",
  "test-results",
  "playwright-report",
]);

function prepareWorkdir(initStateAbs: string, taskRunId: string): string {
  const workdir = join(RUNS_ROOT, "_workdirs", `${RUNNER_NAME}-${taskRunId}`);
  mkdirSync(dirname(workdir), { recursive: true });
  cpSync(initStateAbs, workdir, {
    recursive: true,
    dereference: false,
    filter: (src) => {
      const rel = src.slice(initStateAbs.length + 1);
      const top = rel.split("/")[0];
      return !top || !HEAVY_DIRS.has(top);
    },
  });
  return workdir;
}

function copyTaskAssets(taskFileAbs: string, workdir: string): void {
  const taskParsed = parse(taskFileAbs);
  const taskDir = taskParsed.dir;
  const taskBaseName = taskParsed.name;
  const baselinesSrcDir = join(taskDir, taskBaseName);

  const dotTaskDir = join(workdir, ".task");
  mkdirSync(dotTaskDir, { recursive: true });

  // BRIEF.md (the task markdown)
  cpSync(taskFileAbs, join(dotTaskDir, "BRIEF.md"));

  // baselines/ (sibling dir to the task md)
  const baselinesDestDir = join(dotTaskDir, "baselines");
  if (existsSync(baselinesSrcDir)) {
    cpSync(baselinesSrcDir, baselinesDestDir, { recursive: true });
  } else {
    mkdirSync(baselinesDestDir, { recursive: true });
    console.warn(
      `[runner] baselines dir missing at ${baselinesSrcDir} — VRT will fail`,
    );
  }
}

function ensureNodeModules(workdir: string, initStateAbs: string): void {
  const wdNodeModules = join(workdir, "node_modules");
  if (existsSync(wdNodeModules)) return;
  const sourceNodeModules = join(initStateAbs, "node_modules");
  if (existsSync(sourceNodeModules)) {
    symlinkSync(sourceNodeModules, wdNodeModules, "dir");
    return;
  }
  console.error("[runner] running `npm install` in workdir (slow first run)…");
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: workdir,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(`npm install failed in ${workdir}`);
  }
}

interface ToolCallRecord {
  name: string;
  input: unknown;
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const taskAbs = resolve(args.taskFile);
  const initStateAbs = resolve(args.initStateDir);
  const agentAbs = resolve(args.agentFile);

  if (!existsSync(taskAbs)) throw new Error(`Task not found: ${taskAbs}`);
  if (!existsSync(initStateAbs))
    throw new Error(`Init state not found: ${initStateAbs}`);
  if (!existsSync(agentAbs)) throw new Error(`Agent file not found: ${agentAbs}`);

  const taskId = parse(taskAbs).name;
  const taskRunId = randomUUID();
  const agentDef = parseAgentFile(agentAbs);
  const resolvedModel = resolveModel(args.modelName);
  const startedAt = Date.now();

  const workdir = prepareWorkdir(initStateAbs, taskRunId);
  copyTaskAssets(taskAbs, workdir);
  ensureNodeModules(workdir, initStateAbs);

  const briefPath = join(workdir, ".task", "BRIEF.md");
  const baselinesDir = join(workdir, ".task", "baselines");

  console.error(`taskId       : ${taskId}`);
  console.error(`taskRunId    : ${taskRunId}`);
  console.error(`workdir      : ${workdir}`);
  console.error(`brief        : ${briefPath}`);
  console.error(`baselines    : ${baselinesDir}`);
  console.error(`agent        : ${agentDef.name} (${agentDef.tools.length} tools)`);
  console.error(`model        : ${resolvedModel}`);
  console.error("");

  // The user message IS the task brief, verbatim. Workflow / conventions /
  // env-var contract live in the agent system prompt (agents/<agent>.md), not
  // here — the runner is task-agnostic plumbing.
  const taskPrompt = readFileSync(briefPath, "utf8");

  const result = query({
    prompt: taskPrompt,
    options: {
      cwd: workdir,
      systemPrompt: agentDef.body,
      model: resolvedModel,
      permissionMode: "bypassPermissions",
      allowedTools: agentDef.tools,
    },
  });

  let finalAssistantText = "";
  const toolCalls: ToolCallRecord[] = [];
  let turnCount = 0;

  for await (const msg of result) {
    if (msg.type === "assistant") {
      turnCount++;
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            finalAssistantText = block.text;
          } else if (block.type === "tool_use") {
            toolCalls.push({ name: block.name, input: block.input });
            console.error(`[turn ${turnCount}] tool_use: ${block.name}`);
          }
        }
      }
    } else if (msg.type === "result") {
      console.error(`[result] subtype=${msg.subtype}`);
    }
  }

  const elapsedMs = Date.now() - startedAt;

  // Persist run output
  const runOutputDir = join(RUNS_ROOT, RUNNER_NAME, taskId, taskRunId);
  mkdirSync(runOutputDir, { recursive: true });

  writeFileSync(
    join(runOutputDir, "RESPONSE.md"),
    `${finalAssistantText.trim()}\n`,
    "utf8",
  );

  const summary = {
    version: "1",
    results: [{ promptDef: { name: taskId, prompt: taskPrompt }, score: null }],
    details: {
      summary: {
        taskId,
        prompt: taskPrompt,
        taskRunId,
        environmentId: parse(initStateAbs).name,
        model: resolvedModel,
        runner: { id: RUNNER_NAME },
        pipelineId: agentDef.name,
        elapsedMs,
        turnCount,
        toolCalls,
      },
    },
  };
  writeFileSync(
    join(runOutputDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  // Copy .bench (verifier + validator JSON outputs) and the agent's src/lib/
  const benchDir = join(workdir, ".bench");
  if (existsSync(benchDir)) {
    cpSync(benchDir, join(runOutputDir, "bench"), { recursive: true });
  }
  const agentSrcDir = join(workdir, "src", "lib");
  if (existsSync(agentSrcDir)) {
    cpSync(agentSrcDir, join(runOutputDir, "agent-src", "lib"), {
      recursive: true,
    });
  }

  console.error(`\nDone in ${elapsedMs}ms (${turnCount} turns).`);
  console.error(`Run output: ${runOutputDir}`);
  console.error(`Workdir kept at: ${workdir}`);
  console.error(
    `(rm -rf ${workdir} when you're done inspecting — workdirs are not auto-cleaned)`,
  );
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
