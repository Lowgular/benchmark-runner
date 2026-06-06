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
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

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

export type Message =
  | { t: "user"; text: string }
  | { t: "assistant"; turn: number; text: string; usage: Usage }
  | { t: "thinking"; turn: number; text: string }
  | { t: "tool_use"; turn: number; id: string; name: string; input: unknown }
  | { t: "tool_result"; turn: number; toolUseId: string; isError: boolean; content: string }
  | { t: "result"; status: "completed" | "error"; turnCount: number; totalUsage: Usage; model: string; costUsd?: number }
  | { t: "error"; message: string };

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

export interface AgentDef {
  name: string;
  description: string;
  tools: string[];
  mcpServers: Record<string, McpServerConfig>;
  body: string;
}

function parseAgentFile(filePath: string): AgentDef {
  const content = readFileSync(filePath, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) throw new Error(`No YAML frontmatter found in ${filePath}`);
  const [, frontmatterStr = "", body = ""] = fm;
  const frontmatter = (parseYaml(frontmatterStr) ?? {}) as Record<string, unknown>;
  const tools = Array.isArray(frontmatter["tools"])
    ? (frontmatter["tools"] as unknown[]).map(String)
    : [];
  const mcpServers =
    (frontmatter["mcpServers"] as Record<string, McpServerConfig> | undefined) ?? {};
  return {
    name: String(frontmatter["name"] ?? ""),
    description: String(frontmatter["description"] ?? ""),
    tools,
    mcpServers,
    body: body.trim(),
  };
}

// ---------- CLI ----------

interface CliArgs {
  harness: string;
  agentFile: string;
  taskFile: string;
  modelName: string;
  /** Client-generated GUID for this run; enables summary.json writing. */
  runId: string;
  /** Init-state dir; its basename becomes environmentId in summary.json. */
  initState: string;
  /** Preflight mode: validate harness requiredEnv and exit (no run). */
  checkEnv: boolean;
  verbose: boolean;
}

const USAGE =
  "Usage: bun run harness/framework.ts \\\n" +
  "         --harness <name> --agent <file> --task <file> --model <name> \\\n" +
  "         [--run-id <guid> --init-state <dir>] [--verbose|-v]\n" +
  "       bun run harness/framework.ts --harness <name> --check-env\n";

function parseArgs(argv: string[]): CliArgs {
  let harness = "";
  let agentFile = "";
  let taskFile = "";
  let modelName = "";
  let runId = "";
  let initState = "";
  let checkEnv = false;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") {
      verbose = true;
    } else if (a === "--check-env") {
      checkEnv = true;
    } else if (a === "--harness") {
      harness = argv[++i] ?? "";
    } else if (a === "--agent") {
      agentFile = argv[++i] ?? "";
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
    if (!agentFile) missing.push("--agent");
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

  return { harness, agentFile, taskFile, modelName, runId, initState, checkEnv, verbose };
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

// ---------- Verbose logging dispatch ----------

function logMessage(msg: Message): void {
  switch (msg.t) {
    case "thinking":
      console.log(`\n${C.magenta}● Thinking${C.reset}\n${C.dim}${truncate(msg.text, 600)}${C.reset}`);
      break;
    case "assistant":
      if (msg.text.trim()) console.log(`\n${C.bold}● Assistant${C.reset}\n${msg.text}`);
      break;
    case "tool_use":
      console.log(`\n${C.dim}[turn ${msg.turn}]${C.reset} ${fmtToolUse(msg.name, msg.input)}`);
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

  const agentAbs = resolve(args.agentFile);
  const taskFileAbs = resolve(args.taskFile);
  if (!existsSync(agentAbs)) throw new Error(`Agent file not found: ${agentAbs}`);
  if (!existsSync(taskFileAbs)) throw new Error(`Task file not found: ${taskFileAbs}`);

  const agent = parseAgentFile(agentAbs);
  const task = readFileSync(taskFileAbs, "utf8");
  const resolvedModel = resolveModel(args.modelName);
  const cwd = process.cwd();

  // Skill names = directory names under the agent's skills/ (the recipe's
  // declared skill surface). Harnesses enable exactly these, never "all".
  const agentSkillsDir = join(dirname(agentAbs), "skills");
  const skills = existsSync(agentSkillsDir)
    ? readdirSync(agentSkillsDir, { withFileTypes: true })
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
  })) {
    const line = redact(JSON.stringify({ ts: new Date().toISOString(), ...msg }));
    appendFileSync(traceFile, `${line}\n`, "utf8");
    if (msg.t === "assistant" && msg.text.trim()) finalAssistantText = msg.text;
    if (msg.t === "result") resultEvent = msg;
    if (args.verbose) logMessage(msg);
    else if (msg.t === "tool_use") console.error(`[turn ${msg.turn}] tool_use: ${msg.name}`);
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
