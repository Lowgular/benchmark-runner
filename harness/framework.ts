#!/usr/bin/env bun
/**
 * Harness framework — the only CLI entrypoint. Owns everything *except* the
 * agent loop itself:
 *   - CLI parsing
 *   - reading agent file + task file
 *   - resolving model alias
 *   - banner + verbose logging
 *   - writing agent.jsonl (one line per Message yielded by the harness)
 *   - writing RESPONSE.md
 *   - writing summary.json (when --run-id is passed; Pass-1, score=null)
 *
 * The actual agent loop lives in <harness>/src/index.ts as an async generator
 * yielding standard Message events. Framework dynamic-imports it.
 *
 * Usage:
 *   bun run harness/framework.ts \
 *     --harness anthropic-sdk \
 *     --agent <agent-file> \
 *     --task <task-file> \
 *     --model <name> \
 *     [--run-id <guid> --init-state <dir>] \
 *     [--verbose|-v]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAgentFile, type AgentDef } from "./agent-file.ts";
import { resolveModel } from "./models.ts";
import { buildSummary, type ResultEvent } from "./summary.ts";
import { C, fmtToolResult, fmtToolUse, truncate } from "./tool-format.ts";

// ---------- Standard event types every harness must yield ----------

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

/**
 * Optional provenance on every event — pipeline-mode harnesses tag which
 * node produced it (`agent`: pipeline node name or "harness" for gate runs)
 * and which loop cycle it belongs to. Single-agent harnesses omit both;
 * the JSON lines stay byte-identical to before.
 */
type Provenance = { agent?: string; cycle?: number };

export type Message = (
  | { t: "user"; text: string }
  | { t: "assistant"; turn: number; text: string; usage: Usage }
  | { t: "thinking"; turn: number; text: string }
  | { t: "tool_use"; turn: number; id: string; name: string; input: unknown }
  | { t: "tool_result"; turn: number; toolUseId: string; isError: boolean; content: string }
  | { t: "result"; status: "completed" | "error"; turnCount: number; totalUsage: Usage; model: string; costUsd?: number }
  | { t: "error"; message: string }
  /**
   * Run artifact produced by the harness (e.g. a pipeline handoff file like
   * feedback.md). The FRAMEWORK writes it — harnesses never touch the
   * filesystem; they yield this event instead. `path` is relative to cwd.
   */
  | { t: "artifact"; path: string; content: string }
) &
  Provenance;

export interface McpServerConfig {
  type: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface HarnessParams {
  task: string;
  systemPrompt: string;
  model: string;
  cwd: string;
  allowedTools: string[];
  mcpServers: Record<string, McpServerConfig>;
  /**
   * Skill names the agent recipe ships (directory names under the agent's
   * skills/). Harnesses with native skill support enable EXACTLY these —
   * never "all discovered" — so runtime-bundled skills (e.g. the Claude CLI's
   * built-ins) don't widen one harness's surface over another's.
   */
  skills: string[];
  /**
   * Env values declared by the plugin's `requiredEnv` export, resolved and
   * validated by the framework. Plugins must read keys from here — never
   * from process.env (enforced by harness-contract.test.ts).
   */
  secrets: Record<string, string>;
  /**
   * Debug instrumentation (--debug): harnesses that support it nudge the
   * model to self-report unclear specs / missing tools after each
   * verification cycle, appended to improvements.jsonl in the workspace.
   * Debug runs are diagnostic — their cost/turn metrics are not comparable
   * to clean runs.
   */
  debug: boolean;
}

export type Harness = (params: HarnessParams) => AsyncIterable<Message>;

/** Shape of a harness plugin module: run() plus env declarations. */
export interface HarnessModule {
  run: Harness;
  /** Env vars the plugin cannot run without — validated fail-fast by the framework. */
  requiredEnv?: readonly string[];
  /** Env vars used when present (e.g. SDK-internal auth) — resolved + redacted, not validated. */
  optionalEnv?: readonly string[];
}

// ---------- Agent file + model ----------

// Parsing lives in agent-file.ts (shared with pipeline-mode harness modules).
export type { AgentDef } from "./agent-file.ts";

// ---------- CLI ----------

interface CliArgs {
  harness: string;
  taskFile: string;
  modelName: string;
  /** Client-generated GUID for this run; enables summary.json writing. */
  runId: string;
  /** Init-state dir; its basename becomes environmentId in summary.json. */
  initState: string;
  /** Preflight mode: validate harness requiredEnv and exit (no run). */
  checkEnv: boolean;
  verbose: boolean;
  /** Debug instrumentation: model self-reports friction to improvements.jsonl. */
  debug: boolean;
}

const USAGE =
  "Usage: bun run harness/framework.ts \\\n" +
  "         --harness <name> --task <file> --model <name> \\\n" +
  "         [--run-id <guid> --init-state <dir>] [--verbose|-v] [--debug]\n" +
  "       (run from the composed workspace — the recipe is discovered in cwd:\n" +
  "        AGENTS.md = single-agent, pipeline.json = pipeline)\n" +
  "       bun run harness/framework.ts --harness <name> --check-env\n";

function parseArgs(argv: string[]): CliArgs {
  let harness = "";
  let taskFile = "";
  let modelName = "";
  let runId = "";
  let initState = "";
  let checkEnv = false;
  let verbose = false;
  let debug = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") {
      verbose = true;
    } else if (a === "--debug") {
      debug = true;
    } else if (a === "--check-env") {
      checkEnv = true;
    } else if (a === "--harness") {
      harness = argv[++i] ?? "";
    } else if (a === "--task") {
      taskFile = argv[++i] ?? "";
    } else if (a === "--model") {
      modelName = argv[++i] ?? "";
    } else if (a === "--run-id") {
      runId = argv[++i] ?? "";
    } else if (a === "--init-state") {
      initState = argv[++i] ?? "";
    } else {
      console.error(`Unknown arg: ${a}`);
      console.error(USAGE);
      process.exit(1);
    }
  }

  const missing: string[] = [];
  if (!harness) missing.push("--harness");
  if (!checkEnv) {
    if (!taskFile) missing.push("--task");
    if (!modelName) missing.push("--model");
  }
  if (missing.length) {
    console.error(`Missing args: ${missing.join(", ")}`);
    console.error(USAGE);
    process.exit(1);
  }
  if (runId && !initState) {
    console.error("--run-id requires --init-state (environmentId for summary.json)");
    console.error(USAGE);
    process.exit(1);
  }

  return { harness, taskFile, modelName, runId, initState, checkEnv, verbose, debug };
}

// ---------- Recipe discovery (the composed workspace is self-describing) ----------

/**
 * Layer 2 of run_task.sh rsyncs the agent folder into the run dir, so the
 * recipe is discovered in cwd, not passed by path:
 *   - root AGENTS.md            → the default single-agent recipe
 *   - pipeline.json, no AGENTS.md → a pipeline recipe: sub-agents own their
 *     prompts/tools; the framework only needs a name for summary.json
 *     (pipeline.json `name`, default "pipeline").
 */
function discoverRecipe(cwd: string): AgentDef {
  const recipePath = join(cwd, "AGENTS.md");
  if (existsSync(recipePath)) return parseAgentFile(recipePath);
  const pipelinePath = join(cwd, "pipeline.json");
  if (existsSync(pipelinePath)) {
    const spec = JSON.parse(readFileSync(pipelinePath, "utf8")) as Record<string, unknown>;
    return {
      name: String(spec["name"] ?? "pipeline"),
      description: "",
      tools: [],
      mcpServers: {},
      body: "",
    };
  }
  throw new Error(`Workspace is not a recipe: neither AGENTS.md nor pipeline.json found in ${cwd}`);
}

// ---------- Secrets (the only process.env access in the pipeline) ----------

/**
 * Resolves the plugin's declared requiredEnv from process.env. Fails fast
 * with a clear message if anything is missing — before any workspace cost.
 */
function resolveSecrets(
  harnessName: string,
  requiredEnv: readonly string[],
  optionalEnv: readonly string[],
): Record<string, string> {
  const secrets: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of requiredEnv) {
    const value = process.env[key];
    if (value) secrets[key] = value;
    else missing.push(key);
  }
  for (const key of optionalEnv) {
    const value = process.env[key];
    if (value) secrets[key] = value;
  }
  if (missing.length) {
    console.error(`Missing required env var(s) for harness '${harnessName}': ${missing.join(", ")}`);
    process.exit(1);
  }
  return secrets;
}

/** Scrubs secret values from text destined for run artifacts (agent.jsonl, RESPONSE.md). */
function makeRedactor(secrets: Record<string, string>): (text: string) => string {
  const entries = Object.entries(secrets).filter(([, v]) => v.length > 0);
  if (!entries.length) return (text) => text;
  return (text) => {
    let out = text;
    for (const [key, value] of entries) {
      out = out.replaceAll(value, `[REDACTED:${key}]`);
    }
    return out;
  };
}

// ---------- Run artifacts yielded by harnesses ----------

/**
 * Writes a harness-yielded artifact (e.g. a pipeline handoff file like
 * feedback.md) under the run dir. Harnesses never write files themselves —
 * they yield `{t:"artifact"}` events and the framework persists them here.
 */
function writeArtifact(cwd: string, relPath: string, content: string): void {
  const abs = resolve(cwd, relPath);
  if (abs !== resolve(cwd) && !abs.startsWith(`${resolve(cwd)}/`)) {
    throw new Error(`Artifact path escapes the run dir: ${relPath}`);
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

// ---------- Verbose logging dispatch ----------

/** "[implementer c2] " prefix for pipeline-tagged events; empty for single-agent runs. */
function whoTag(msg: Message): string {
  if (!msg.agent) return "";
  return `${C.cyan}[${msg.agent}${msg.cycle != null ? ` c${msg.cycle}` : ""}]${C.reset} `;
}

function logMessage(msg: Message): void {
  switch (msg.t) {
    case "thinking":
      console.log(`\n${whoTag(msg)}${C.magenta}● Thinking${C.reset}\n${C.dim}${truncate(msg.text, 600)}${C.reset}`);
      break;
    case "assistant":
      if (msg.text.trim()) console.log(`\n${whoTag(msg)}${C.bold}● Assistant${C.reset}\n${msg.text}`);
      break;
    case "tool_use":
      console.log(`\n${whoTag(msg)}${C.dim}[turn ${msg.turn}]${C.reset} ${fmtToolUse(msg.name, msg.input)}`);
      break;
    case "tool_result": {
      const { body, lineCount } = fmtToolResult(msg.content, msg.isError);
      const tag = msg.isError ? `${C.red}✗ error${C.reset}` : `${C.green}✓${C.reset}`;
      console.log(
        `${tag} ${C.dim}(${lineCount} line${lineCount === 1 ? "" : "s"})${C.reset}\n${body}`,
      );
      break;
    }
    case "result":
      console.error(`${C.dim}[result] status=${msg.status} turns=${msg.turnCount}${C.reset}`);
      break;
    case "error":
      console.error(`${C.red}[error]${C.reset} ${msg.message}`);
      break;
    case "artifact":
      console.log(`${C.dim}[artifact] wrote ${msg.path} (${msg.content.length} chars)${C.reset}`);
      break;
    case "user":
      // first user message is the task; usually too noisy to print
      break;
  }
}

// ---------- Main ----------

const HERE = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const harnessEntry = join(HERE, args.harness, "src", "index.ts");
  if (!existsSync(harnessEntry)) {
    throw new Error(`Harness not found: ${harnessEntry}`);
  }
  const { run, requiredEnv = [], optionalEnv = [] } = (await import(harnessEntry)) as HarnessModule;
  const secrets = resolveSecrets(args.harness, requiredEnv, optionalEnv);

  if (args.checkEnv) {
    console.error(`env OK for harness '${args.harness}'${requiredEnv.length ? ` (${requiredEnv.join(", ")})` : " (none required)"}`);
    return;
  }

  const redact = makeRedactor(secrets);

  const taskFileAbs = resolve(args.taskFile);
  if (!existsSync(taskFileAbs)) throw new Error(`Task file not found: ${taskFileAbs}`);

  const cwd = process.cwd();
  const agent = discoverRecipe(cwd);
  const task = readFileSync(taskFileAbs, "utf8");
  const resolvedModel = resolveModel(args.modelName);

  // Skill names = directory names under the recipe's skills/ (the declared
  // skill surface). Harnesses enable exactly these, never "all". A harness
  // workspace adapter may already have moved skills/ → .claude/skills/
  // (it runs before the framework), so check the mounted location first.
  const skillsDir = [join(cwd, ".claude", "skills"), join(cwd, "skills")].find((d) => existsSync(d));
  const skills = skillsDir
    ? readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];

  const mcpNames = Object.keys(agent.mcpServers);
  console.error(`harness     : ${args.harness}`);
  console.error(`agent       : ${agent.name} (${agent.tools.length} tools${mcpNames.length ? `, ${mcpNames.length} MCP: ${mcpNames.join(",")}` : ""})`);
  console.error(`task        : ${taskFileAbs}`);
  console.error(`workdir     : ${cwd}`);
  console.error(
    `model       : ${resolvedModel}${args.modelName !== resolvedModel ? ` (alias: ${args.modelName})` : ""}`,
  );
  console.error("");

  const traceFile = join(cwd, "agent.jsonl");
  writeFileSync(traceFile, "", "utf8");

  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  let finalAssistantText = "";
  let resultEvent: ResultEvent | null = null;

  for await (const msg of run({
    task,
    systemPrompt: agent.body,
    model: resolvedModel,
    cwd,
    allowedTools: agent.tools,
    mcpServers: agent.mcpServers,
    skills,
    secrets,
    debug: args.debug,
  })) {
    const line = redact(JSON.stringify({ ts: new Date().toISOString(), ...msg }));
    appendFileSync(traceFile, `${line}\n`, "utf8");
    if (msg.t === "assistant" && msg.text.trim()) finalAssistantText = msg.text;
    if (msg.t === "result") resultEvent = msg;
    if (msg.t === "artifact") writeArtifact(cwd, msg.path, redact(msg.content));
    if (args.verbose) logMessage(msg);
    else if (msg.t === "tool_use") {
      const who = msg.agent ? `[${msg.agent}${msg.cycle != null ? ` c${msg.cycle}` : ""}] ` : "";
      console.error(`${who}[turn ${msg.turn}] tool_use: ${msg.name}`);
    }
  }

  writeFileSync(join(cwd, "RESPONSE.md"), `${redact(finalAssistantText.trim())}\n`, "utf8");

  const written = ["RESPONSE.md", "agent.jsonl"];
  if (args.runId) {
    const summary = buildSummary({
      taskId: parsePath(taskFileAbs).name,
      prompt: task,
      taskRunId: args.runId,
      environmentId: parsePath(resolve(args.initState)).name,
      model: resolvedModel,
      pipelineId: agent.name,
      harnessId: args.harness,
      elapsedMs: Date.now() - startedAt,
      startedAt: startedAtIso,
      result: resultEvent,
    });
    writeFileSync(join(cwd, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    written.push("summary.json");
  }

  console.error(
    `\nDone in ${Date.now() - startedAt}ms. Wrote ${written.join(" + ")} to ${cwd}`,
  );
}

main().catch((err: unknown) => {
  console.error("Framework failed:", err);
  process.exit(1);
});
