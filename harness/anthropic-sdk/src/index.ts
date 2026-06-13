/**
 * Anthropic SDK harness. Pure async generator — no CLI, no file I/O.
 * The framework wraps this and handles agent.jsonl, RESPONSE.md, logging.
 *
 * Yields Message events in real time as the SDK stream produces them, and
 * a final `result` event with totals at the end.
 *
 * Cost visibility (LOOP-02): per-turn token usage is present on every assistant
 * event; final costUsd is present on the result event. Both land in agent.jsonl
 * via the framework writer — no extra instrumentation needed.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";

import type { HarnessParams, Message, Usage } from "../../framework.ts";
import { loadPipeline, runPipeline } from "./pipeline.ts";
import { normalizeUsage, stringifyToolResultContent } from "./sdk-utils.ts";

/**
 * The Claude Agent SDK reads ANTHROPIC_API_KEY from the environment itself —
 * but can also auth via Claude Code's local OAuth credentials, so the key is
 * optional. Declaring it gives trace redaction coverage when it IS set.
 */
export const optionalEnv = ["ANTHROPIC_API_KEY"] as const;

/** Hard backstop — generous ceiling sized well above healthy converging runs. Tune from observed data. Also serves as the per-run cost guard for the autonomous convergence loop. */
const MAX_TURNS = 150;

/**
 * --debug instrumentation: after every per-element verification cycle
 * (a Bash call running `verify:element`), inject a reflection nudge as
 * PostToolUse additionalContext. The model self-reports friction — unclear
 * specs, wrong assumptions, missing tools — by appending JSON lines to
 * improvements.jsonl in the workspace; the operator mines that file after
 * the run. Costs context — debug runs are diagnostic, not comparable.
 */
const REFLECTION_NUDGE =
  "[debug instrumentation — not part of the task] You just ran a verification cycle. " +
  "Reflect for one beat before continuing: in THIS mini-iteration, was anything unclear, " +
  "wrongly assumed, or missing — in the plan, the spec, the feedback you got, or the tools available? " +
  "If yes, append ONE line to improvements.jsonl (create if absent) in the workspace root:\n" +
  '{"element":"<story-id>","phase":"<plan|implement|verify|validate>","struggle":"<what was unclear or wrong, concretely>","wanted":"<the tool/feedback/spec-detail that would have removed the struggle>"}\n' +
  "Be concrete and honest — 'everything was clear' means write NOTHING and continue. " +
  "Do not let this interrupt your loop: reflect, optionally append, then proceed with the next step.";

export async function* run(params: HarnessParams): AsyncGenerator<Message> {
  // Pipeline mode: a workspace shipping pipeline.json (recipe layer) switches
  // this harness into a declarative multi-agent graph walker. No file →
  // exactly the single-agent behavior below.
  let pipeline: ReturnType<typeof loadPipeline> = null;
  try {
    pipeline = loadPipeline(params.cwd);
  } catch (err) {
    yield { t: "error", message: `pipeline.json invalid: ${err instanceof Error ? err.message : String(err)}` };
    yield {
      t: "result",
      status: "error",
      turnCount: 0,
      totalUsage: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
      model: params.model,
    };
    return;
  }
  if (pipeline) {
    yield* runPipeline(params, pipeline);
    return;
  }

  yield { t: "user", text: params.task };

  const stream = query({
    prompt: params.task,
    options: {
      cwd: params.cwd,
      // No systemPrompt override: the recipe body arrives as CLAUDE.md project
      // memory (mounted by workspace-setup.sh), layered on the SDK's default
      // Claude Code system prompt. A string systemPrompt would REPLACE that
      // battle-tested default — the old invisible-prompt setup.
      model: params.model,
      permissionMode: "bypassPermissions",
      allowedTools: params.allowedTools,
      // HARD tool-surface cap (integrity boundary). `allowedTools` is only a
      // permission allowlist — under bypassPermissions it restricts nothing;
      // `tools` is what actually removes built-ins (WebSearch, WebFetch, …)
      // from the model's surface. MCP tool names don't belong here — MCP
      // surface comes from the workspace .mcp.json. "Skill" must be in the
      // base set explicitly or the cap silently disables `skills: "all"`
      // (probe-verified).
      tools: [...params.allowedTools.filter((t) => !t.startsWith("mcp__")), "Skill"],
      maxTurns: MAX_TURNS,
      // Benchmark isolation: load ONLY the run workspace's .claude (skills shipped
      // by the init-state). Omitting this loads the operator's ~/.claude settings
      // and skills into the benchmark agent — contamination.
      settingSources: ["project"],
      // Exactly the recipe's declared skills (progressive disclosure: only
      // name+description enter context until invoked). NOT "all": that would
      // also enable the CLI's bundled skills, widening this harness's surface
      // over harnesses with no native skill runtime (probe-verified leak).
      skills: params.skills,
      // No mcpServers here: workspace-setup.sh mounts them as the workspace's
      // .mcp.json (Claude Code's project MCP standard), auto-approved via
      // .claude/settings.json enableAllProjectMcpServers. params.mcpServers is
      // deliberately ignored — native config over programmatic injection.
      ...(params.debug
        ? {
            hooks: {
              PostToolUse: [
                {
                  matcher: "Bash",
                  hooks: [
                    async (input: unknown) => {
                      const cmd = String(
                        ((input as { tool_input?: { command?: unknown } }).tool_input
                          ?.command as string) ?? "",
                      );
                      if (!cmd.includes("verify:element")) return {};
                      return {
                        hookSpecificOutput: {
                          hookEventName: "PostToolUse" as const,
                          additionalContext: REFLECTION_NUDGE,
                        },
                      };
                    },
                  ],
                },
              ],
            },
          }
        : {}),
    },
  });

  let turn = 0;
  const totalUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  let status: "completed" | "error" = "completed";
  let costUsd: number | undefined;

  // try/catch so a mid-stream SDK death (e.g. the CLI subprocess getting
  // SIGTERM'd) still produces error + result events — without this, the
  // generator throws, the framework crashes, and the run leaves no result
  // line in agent.jsonl and no summary.json (observed: agent's broad
  // `pkill -f http-server` killed its own CLI process tree).
  try {
  for await (const sdkMsg of stream) {
    if (sdkMsg.type === "assistant") {
      turn++;
      const message = (sdkMsg as unknown as {
        message: { content: unknown; usage?: Record<string, unknown> };
      }).message;
      const usage = normalizeUsage(message.usage);
      totalUsage.input += usage.input;
      totalUsage.output += usage.output;
      totalUsage.cacheRead += usage.cacheRead;
      totalUsage.cacheCreate += usage.cacheCreate;

      if (!Array.isArray(message.content)) continue;

      let assistantText = "";
      for (const block of message.content as Array<Record<string, unknown>>) {
        const type = String(block["type"] ?? "");
        if (type === "text") {
          assistantText = String(block["text"] ?? "");
        } else if (type === "thinking") {
          yield { t: "thinking", turn, text: String(block["thinking"] ?? "") };
        } else if (type === "tool_use") {
          yield {
            t: "tool_use",
            turn,
            id: String(block["id"] ?? ""),
            name: String(block["name"] ?? ""),
            input: block["input"],
          };
        }
      }
      if (assistantText.trim()) {
        yield { t: "assistant", turn, text: assistantText, usage };
      }
    } else if (sdkMsg.type === "user") {
      const content = (sdkMsg as { message?: { content?: unknown } }).message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content as Array<Record<string, unknown>>) {
        if (block["type"] !== "tool_result") continue;
        yield {
          t: "tool_result",
          turn,
          toolUseId: String(block["tool_use_id"] ?? ""),
          isError: Boolean(block["is_error"]),
          content: stringifyToolResultContent(block["content"]),
        };
      }
    } else if (sdkMsg.type === "result") {
      const r = sdkMsg as { subtype?: string; total_cost_usd?: number };
      status = r.subtype === "success" ? "completed" : "error";
      if (typeof r.total_cost_usd === "number") costUsd = r.total_cost_usd;
    }
  }
  } catch (err) {
    status = "error";
    yield { t: "error", message: err instanceof Error ? err.message : String(err) };
  }

  yield {
    t: "result",
    status,
    turnCount: turn,
    totalUsage,
    model: params.model,
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}
