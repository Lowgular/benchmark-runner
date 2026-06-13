/**
 * Pipeline mode — the declarative multi-agent loop.
 *
 * When the workspace ships a `pipeline.json` (recipe layer, next to AGENTS.md),
 * the harness stops being a single-agent runner and becomes a GRAPH WALKER.
 * The graph is homogeneous — everything is a node, edges are uniform:
 *
 *   - `type:"agent"`  nodes spawn/resume a sub-agent (`agent:` = dir with an
 *                     AGENTS.md in the same frontmatter format as the recipe,
 *                     + optional `model:`/`maxTurns:`). Named by ROLE.
 *   - `type:"system"` nodes run `exec` in the workspace — exit 0 = pass,
 *                     non-zero = fail. Named by ACTION. Deterministic:
 *                     control flow routes on EXIT CODES, never on what an
 *                     agent claims.
 *   - edges carry the source node's output as input to the target: an agent's
 *     final message, a system node's exit code + output tail. `on:"pass"|"fail"`
 *     is only valid on edges leaving system nodes (agents do work, system
 *     nodes make decisions).
 *
 * The graph runs once per element from tests/stories/expected.json (walker
 * convention, not schema) — single-element tasks make one pass; N entries
 * chain with fresh agent sessions per element. `{element}` is substituted in
 * `exec` strings.
 *
 * Example (the VRT implementer ⇄ reviewer loop):
 *   start → implementer → verify ─ pass → end
 *                                └ fail → reviewer → implementer (fix-brief)
 *
 * This module READS workspace state (pipeline.json, sub-agent files, the
 * elements list) and SPAWNS system-node commands — sanctioned for
 * pipeline-mode harness code. It never writes files (artifacts are yielded as
 * events) and never reads the environment directly.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { query } from "@anthropic-ai/claude-agent-sdk";

import { parseAgentFile, type AgentDef } from "../../agent-file.ts";
import type { HarnessParams, Message, Usage } from "../../framework.ts";
import { resolveModel } from "../../models.ts";
import { addUsage, normalizeUsage, stringifyToolResultContent, zeroUsage } from "./sdk-utils.ts";

// ---------- Spec types (pipeline.json) ----------

export type PipelineNode =
  | {
      id: string;
      type: "agent";
      /** Directory (relative to cwd) containing this node's AGENTS.md. */
      agent: string;
      /** "persistent": resume the same SDK session on re-entry (within one element). Default "fresh". */
      session?: "persistent" | "fresh";
      /** Capture the node's final message to this file (yielded as an artifact event). */
      output?: string;
    }
  | {
      id: string;
      type: "system";
      /** Shell command run in the workspace; `{element}` is substituted. Exit 0 = pass. */
      exec: string;
    };

export interface PipelineEdge {
  from: string;
  to: string;
  /** Only valid on edges leaving a system node: route on its exit code. */
  on?: "pass" | "fail";
}

export interface PipelineSpec {
  version: number;
  /** Recipe name — becomes pipelineId in summary.json (read by framework.ts recipe discovery). */
  name?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface LoadedPipeline {
  spec: PipelineSpec;
  /** Agent defs keyed by node id (agent nodes only). */
  agents: Record<string, AgentDef>;
  elements: string[];
}

// ---------- Tunables ----------

/** Per-node-query ceiling when the node's AGENTS.md declares no maxTurns. */
const DEFAULT_NODE_MAX_TURNS = 60;
/**
 * Cumulative-turn runaway brake for the whole run. There is deliberately NO
 * repair-cycle cap (the loop runs until the gate is green); this only stops
 * a pathological non-converging run from burning unbounded budget.
 */
const MAX_TOTAL_TURNS = 400;
/** System-node commands get this long before being treated as failed. */
const SYSTEM_TIMEOUT_MS = 15 * 60 * 1000;
/** Tail of system-node output carried into the trace and downstream prompts. */
const SYSTEM_OUTPUT_TAIL_CHARS = 8_000;

const RESERVED_NODE_IDS = new Set(["start", "end", "harness"]);
const ELEMENTS_FILE = "tests/stories/expected.json";

// ---------- Loading + validation ----------

/** Returns null when the workspace has no pipeline.json; throws on an invalid one. */
export function loadPipeline(cwd: string): LoadedPipeline | null {
  const specPath = join(cwd, "pipeline.json");
  if (!existsSync(specPath)) return null;

  const spec = JSON.parse(readFileSync(specPath, "utf8")) as PipelineSpec;
  if (spec.version !== 1) throw new Error(`pipeline.json: unsupported version ${spec.version}`);
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    throw new Error("pipeline.json: no nodes defined");
  }
  if (!Array.isArray(spec.edges) || spec.edges.length === 0) {
    throw new Error("pipeline.json: no edges defined");
  }

  const byId = new Map<string, PipelineNode>();
  for (const node of spec.nodes) {
    if (!node.id) throw new Error("pipeline.json: node without id");
    if (RESERVED_NODE_IDS.has(node.id)) throw new Error(`pipeline.json: node id '${node.id}' is reserved`);
    if (byId.has(node.id)) throw new Error(`pipeline.json: duplicate node id '${node.id}'`);
    if (node.type === "agent") {
      if (!node.agent) throw new Error(`pipeline.json: agent node '${node.id}' missing 'agent' dir`);
    } else if (node.type === "system") {
      if (!node.exec) throw new Error(`pipeline.json: system node '${node.id}' missing 'exec'`);
    } else {
      throw new Error(`pipeline.json: node '${(node as { id: string }).id}' has unknown type`);
    }
    byId.set(node.id, node);
  }

  for (const edge of spec.edges) {
    if (edge.from !== "start" && !byId.has(edge.from)) {
      throw new Error(`pipeline.json: edge from unknown node '${edge.from}'`);
    }
    if (edge.to !== "end" && !byId.has(edge.to)) {
      throw new Error(`pipeline.json: edge targets unknown node '${edge.to}'`);
    }
    const fromNode = byId.get(edge.from);
    if (edge.on && (!fromNode || fromNode.type !== "system")) {
      throw new Error(`pipeline.json: 'on' is only valid on edges leaving system nodes (edge from '${edge.from}')`);
    }
  }

  const startEdges = spec.edges.filter((e) => e.from === "start");
  if (startEdges.length !== 1) throw new Error("pipeline.json: exactly one edge from 'start' is required");
  if (startEdges[0]!.to === "end") throw new Error("pipeline.json: start cannot route directly to end");

  for (const node of spec.nodes) {
    const out = spec.edges.filter((e) => e.from === node.id);
    if (node.type === "system") {
      const pass = out.filter((e) => e.on === "pass");
      const fail = out.filter((e) => e.on === "fail");
      const plain = out.filter((e) => !e.on);
      if (pass.length !== 1 || fail.length !== 1 || plain.length > 0) {
        throw new Error(
          `pipeline.json: system node '${node.id}' must have exactly one on:"pass" and one on:"fail" edge (and no unconditional edges)`,
        );
      }
    } else {
      // Agent nodes produce exactly one event (finishing) — at most one
      // unconditional edge; none = the element ends after this node.
      if (out.length > 1) throw new Error(`pipeline.json: agent node '${node.id}' can have at most one outgoing edge`);
    }
  }

  const agents: Record<string, AgentDef> = {};
  for (const node of spec.nodes) {
    if (node.type !== "agent") continue;
    const agentPath = join(cwd, node.agent, "AGENTS.md");
    if (!existsSync(agentPath)) throw new Error(`pipeline.json: node '${node.id}' agent file not found: ${agentPath}`);
    agents[node.id] = parseAgentFile(agentPath);
  }

  const elementsFile = join(cwd, ELEMENTS_FILE);
  if (!existsSync(elementsFile)) throw new Error(`pipeline elements file not found: ${elementsFile}`);
  const elements = (JSON.parse(readFileSync(elementsFile, "utf8")) as unknown[]).map(String);
  if (!elements.length) throw new Error(`pipeline elements file is empty: ${elementsFile}`);

  return { spec, agents, elements };
}

// ---------- Payloads (what edges carry) ----------

type Payload =
  | { kind: "task"; text: string }
  | { kind: "agent"; from: string; text: string }
  | { kind: "system"; from: string; pass: boolean; exitCode: number; text: string };

// ---------- System-node execution ----------

interface SystemResult {
  exitCode: number;
  outputTail: string;
}

function runSystem(command: string, cwd: string): SystemResult {
  const proc = spawnSync("sh", ["-c", command], {
    cwd,
    timeout: SYSTEM_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    encoding: "utf8",
  });
  const combined = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`.trim();
  const outputTail =
    combined.length > SYSTEM_OUTPUT_TAIL_CHARS ? `…${combined.slice(-SYSTEM_OUTPUT_TAIL_CHARS)}` : combined;
  // timeout / spawn failure → status null; treat as failure with the error attached
  const exitCode = proc.status ?? 1;
  return { exitCode, outputTail: proc.error ? `${outputTail}\n[system node spawn error] ${proc.error.message}` : outputTail };
}

// ---------- Prompt composition (walker conventions, not schema) ----------

function composeAgentPrompt(payload: Payload, element: string, cycle: number): string {
  switch (payload.kind) {
    case "task":
      return (
        `${payload.text}\n\n---\n` +
        `PIPELINE SCOPE: this session is scoped to exactly ONE element: \`${element}\`.\n` +
        `Do your job for it per your role, then stop. The pipeline continues after you finish.`
      );
    case "system":
      return (
        `System node \`${payload.from}\` ${payload.pass ? "PASSED" : "FAILED"} for \`${element}\` (exit ${payload.exitCode}).\n\n` +
        `Output (tail):\n\`\`\`\n${payload.text}\n\`\`\`\n\n` +
        `Do your job for this element per your role, then stop.`
      );
    case "agent":
      return (
        `Cycle ${cycle} for \`${element}\`: handoff from \`${payload.from}\` below. ` +
        `Act on it for this element only per your role, then stop — the pipeline continues after you finish.\n\n` +
        `${payload.text}`
      );
  }
}

// ---------- Agent-node execution (one SDK query) ----------

interface NodeRunResult {
  sessionId: string | null;
  finalText: string;
  usage: Usage;
  fatal: boolean;
}

interface NodeRunArgs {
  params: HarnessParams;
  nodeId: string;
  def: AgentDef;
  prompt: string;
  cycle: number;
  resume: string | undefined;
  /** Shared monotonic turn counter so agent.jsonl turns stay ordered across nodes. */
  turn: { n: number };
}

async function* runAgentNode(args: NodeRunArgs): AsyncGenerator<Message, NodeRunResult> {
  const { params, nodeId, def, prompt, cycle, resume, turn } = args;
  const usage = zeroUsage();
  let sessionId: string | null = null;
  let finalText = "";
  let fatal = false;

  const stream = query({
    prompt,
    options: {
      cwd: params.cwd,
      // Node model overrides the run model when its AGENTS.md declares one.
      model: def.model ? resolveModel(def.model) : params.model,
      // Role prompt LAYERS on the battle-tested Claude Code default (the
      // workspace CLAUDE.md — shared conventions — still auto-loads on top).
      systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: def.body },
      permissionMode: "bypassPermissions" as const,
      allowedTools: def.tools,
      // Hard tool-surface cap per node (allowedTools restricts nothing under
      // bypassPermissions). MCP names come from the workspace .mcp.json;
      // "Skill" must be explicit or skills are silently disabled (see index.ts).
      tools: [...def.tools.filter((t) => !t.startsWith("mcp__")), "Skill"],
      maxTurns: def.maxTurns ?? DEFAULT_NODE_MAX_TURNS,
      settingSources: ["project" as const],
      skills: params.skills,
      ...(resume ? { resume } : {}),
    },
  });

  try {
    for await (const sdkMsg of stream) {
      if (sdkMsg.type === "system") {
        const sys = sdkMsg as unknown as { subtype?: string; session_id?: string };
        if (sys.subtype === "init" && sys.session_id) sessionId = sys.session_id;
      } else if (sdkMsg.type === "assistant") {
        turn.n++;
        const message = (sdkMsg as unknown as {
          message: { content: unknown; usage?: Record<string, unknown> };
        }).message;
        addUsage(usage, normalizeUsage(message.usage));
        if (!Array.isArray(message.content)) continue;

        let assistantText = "";
        for (const block of message.content as Array<Record<string, unknown>>) {
          const type = String(block["type"] ?? "");
          if (type === "text") {
            assistantText = String(block["text"] ?? "");
          } else if (type === "thinking") {
            yield { t: "thinking", turn: turn.n, text: String(block["thinking"] ?? ""), agent: nodeId, cycle };
          } else if (type === "tool_use") {
            yield {
              t: "tool_use",
              turn: turn.n,
              id: String(block["id"] ?? ""),
              name: String(block["name"] ?? ""),
              input: block["input"],
              agent: nodeId,
              cycle,
            };
          }
        }
        if (assistantText.trim()) {
          finalText = assistantText;
          yield { t: "assistant", turn: turn.n, text: assistantText, usage: normalizeUsage(message.usage), agent: nodeId, cycle };
        }
      } else if (sdkMsg.type === "user") {
        const content = (sdkMsg as { message?: { content?: unknown } }).message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content as Array<Record<string, unknown>>) {
          if (block["type"] !== "tool_result") continue;
          yield {
            t: "tool_result",
            turn: turn.n,
            toolUseId: String(block["tool_use_id"] ?? ""),
            isError: Boolean(block["is_error"]),
            content: stringifyToolResultContent(block["content"]),
            agent: nodeId,
            cycle,
          };
        }
      }
      // result events per query are NOT forwarded — the pipeline emits one
      // final result for the whole run. A non-success subtype (e.g.
      // error_max_turns) is not fatal here: the system node is the arbiter
      // and the loop self-heals by feeding the failure back.
    }
  } catch (err) {
    // Mid-stream SDK death (subprocess killed etc.) — fatal for the run.
    fatal = true;
    yield { t: "error", message: err instanceof Error ? err.message : String(err), agent: nodeId, cycle };
  }

  return { sessionId, finalText, usage, fatal };
}

// ---------- The walker ----------

interface ElementOutcome {
  element: string;
  cycles: number;
  /** true = ended via a system pass edge; false = not green; null = no system node decided (degenerate pipelines). */
  green: boolean | null;
}

function composeSummary(outcomes: ElementOutcome[], totalTurns: number, status: string): string {
  const lines = outcomes.map((o) => {
    const verdict = o.green === null ? "COMPLETED (no gate)" : o.green ? "GREEN" : "NOT GREEN";
    return `- \`${o.element}\` — ${verdict} after ${o.cycles} verification cycle${o.cycles === 1 ? "" : "s"}`;
  });
  return (
    `# Pipeline run summary\n\n` +
    `Status: ${status} · total turns: ${totalTurns}\n\n` +
    `${lines.join("\n") || "- (no elements completed)"}\n\n` +
    `System-node results are authoritative (harness-run, exit codes in the trace as \`system:*\` tool events). ` +
    `Handoffs are preserved in output artifacts and agent.jsonl.`
  );
}

export async function* runPipeline(params: HarnessParams, p: LoadedPipeline): AsyncGenerator<Message> {
  yield { t: "user", text: params.task };

  const totals = zeroUsage();
  const turn = { n: 0 };
  const outcomes: ElementOutcome[] = [];
  let runStatus: "completed" | "error" = "completed";

  const byId = new Map(p.spec.nodes.map((n) => [n.id, n]));
  const startEdge = p.spec.edges.find((e) => e.from === "start")!;

  outer: for (const element of p.elements) {
    // Fresh sessions per element — small contexts are the point.
    const sessions: Record<string, string> = {};
    let cycle = 0;
    let nodeId = startEdge.to;
    let payload: Payload = { kind: "task", text: params.task };
    let lastSystemPass: boolean | null = null;

    while (true) {
      if (turn.n >= MAX_TOTAL_TURNS) {
        yield {
          t: "error",
          message: `Runaway brake: ${turn.n} cumulative turns reached MAX_TOTAL_TURNS=${MAX_TOTAL_TURNS} (element ${element}, cycle ${cycle})`,
          agent: "harness",
        };
        outcomes.push({ element, cycles: cycle, green: false });
        runStatus = "error";
        break outer;
      }

      const node = byId.get(nodeId);
      if (!node) {
        yield { t: "error", message: `Pipeline walked to unknown node '${nodeId}'`, agent: "harness" };
        runStatus = "error";
        break outer;
      }

      if (node.type === "agent") {
        const def = p.agents[node.id]!;
        const res: NodeRunResult = yield* runAgentNode({
          params,
          nodeId: node.id,
          def,
          prompt: composeAgentPrompt(payload, element, cycle),
          cycle,
          resume: node.session === "persistent" ? sessions[node.id] : undefined,
          turn,
        });
        addUsage(totals, res.usage);
        if (res.fatal) {
          outcomes.push({ element, cycles: cycle, green: false });
          runStatus = "error";
          break outer;
        }
        if (node.session === "persistent" && res.sessionId) sessions[node.id] = res.sessionId;
        if (node.output) {
          yield { t: "artifact", path: node.output, content: res.finalText, agent: node.id, cycle };
        }
        payload = { kind: "agent", from: node.id, text: res.finalText };
      } else {
        cycle++;
        const command = node.exec.replaceAll("{element}", element);
        const sys = runSystem(command, params.cwd);
        const pass = sys.exitCode === 0;
        lastSystemPass = pass;
        const eventId = `${node.id}-${element}-c${cycle}`;
        yield {
          t: "tool_use",
          turn: turn.n,
          id: eventId,
          name: `system:${node.id}`,
          input: { command, element, cycle },
          agent: "harness",
          cycle,
        };
        yield {
          t: "tool_result",
          turn: turn.n,
          toolUseId: eventId,
          isError: !pass,
          content: sys.outputTail,
          agent: "harness",
          cycle,
        };
        payload = { kind: "system", from: node.id, pass, exitCode: sys.exitCode, text: sys.outputTail };
      }

      // Pick the outgoing edge: system nodes route on pass/fail, agent nodes
      // have at most one unconditional edge (none = element done).
      const out = p.spec.edges.filter((e) => e.from === node.id);
      const edge =
        node.type === "system"
          ? out.find((e) => e.on === ((payload as { pass: boolean }).pass ? "pass" : "fail"))
          : out[0];

      if (!edge) {
        outcomes.push({ element, cycles: cycle, green: lastSystemPass });
        break;
      }
      if (edge.to === "end") {
        outcomes.push({ element, cycles: cycle, green: lastSystemPass });
        break;
      }
      nodeId = edge.to;
    }
  }

  // Harness-composed summary is the LAST assistant message → RESPONSE.md is
  // ground truth (system-node outcomes), never a sub-agent's self-report.
  yield { t: "assistant", turn: turn.n, text: composeSummary(outcomes, turn.n, runStatus), usage: zeroUsage(), agent: "harness" };
  // costUsd deliberately omitted: per-query total_cost_usd may double-count
  // resumed sessions; token usage totals are the accurate signal.
  yield { t: "result", status: runStatus, turnCount: turn.n, totalUsage: totals, model: params.model, agent: "harness" };
}
