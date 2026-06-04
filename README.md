# Lowgular Benchmark

A **task-saturation framework**. Iterate on `(agent prompt + tools + model + init-state)` until a task consistently passes. The model-capability matrix (which models can solve what, at what cost) falls out as a side-effect.

This is not a leaderboard for models. It is a tool for engineering reproducible "recipes" — setups that consistently saturate a class of tasks. The recipe is the artifact; the model comparison is its byproduct.

## Quick start

```bash
export ANTHROPIC_API_KEY=...   # for the anthropic-sdk harness
./run_task.sh vrt pricing haiku
```

That command:

1. Creates `runs/vrt/pricing/<guid>/`
2. Rsyncs the init-state into it (respecting the init-state's `.gitignore`)
3. Runs `npm install`
4. Overlays the task folder on top
5. Invokes the harness with the agent + task + model
6. Writes Pass-1 `summary.json` (run metadata, `score: null` until eval runs)

## Repository layout

```
benchmark-runner/
├── run_task.sh                  Entry point. Setup + harness + Pass-1 summary.
│
├── harness/                     Active pipeline
│   ├── framework.ts             CLI, agent.jsonl writer, RESPONSE.md, banner
│   ├── write-summary.ts         Pass-1 summary.json writer
│   ├── tool-format.ts           Verbose-log helpers
│   ├── anthropic-sdk/src/index.ts
│   │                            Harness plug-in (async generator yielding Message events)
│   ├── package.json             Shared deps across harnesses (@anthropic-ai/claude-agent-sdk, ...)
│   ├── tsconfig.json
│   ├── node_modules/, bun.lock
│
├── agents/                      Recipes: one folder per bench
│   └── vrt/AGENTS.md            Frontmatter (name, description, tools) + body (system prompt)
│
├── init-states/                 Workspace scaffolds (committed; rsynced into cwd at run time)
│   └── angular-20-storybook/
│
├── tasks/                       Task definitions: <bench>/<task>/
│   └── vrt/pricing/             Brief at tasks/pricing.md + overlay (src/, tests/...)
│
├── runs/                        Per-run workspaces. Mostly gitignored; curate showcases later.
│   └── vrt/pricing/<guid>/
│
├── task-runners/                LEGACY — deprecating slowly. See "Legacy" below.
├── environments/                LEGACY — WCS env wrappers, unused.
├── eval-runner/                 LEGACY — to be replaced by Pass-2 eval script.
└── code-graph.zip               Legacy: prebuilt code-graph data for plan-and-find runs.
```

## Outputs per run

In `runs/<bench>/<task>/<guid>/`:

| File | What it is |
| --- | --- |
| `agent.jsonl` | Standardized event trace. One JSON line per event (user, assistant, thinking, tool_use, tool_result, result). The last line is `{t:"result", status, turnCount, totalUsage, model, costUsd?}`. Use for debugging + replay. |
| `RESPONSE.md` | Final assistant text. |
| `summary.json` | Run metadata: model, harness, agent, elapsedMs, turnCount, usage, costUsd. `results[0].score: null` until Pass-2 eval runs. |
| `test-results/SUMMARY.md` | Per-viewport pass/fail + diff ratios. Generated when the agent runs `npm run verify:visual`. |
| `test-results/<test>/<viewport>-{expected,actual,diff}.png` | Visual artifacts for failed snapshots. |

## Iteration loop (the actual workflow)

Goal: find a setup that consistently solves a task. Cheap probe first, promote when stable.

1. `./run_task.sh vrt pricing haiku` (cheap probe)
2. **Read four files in this order:**
   - `test-results/SUMMARY.md` → did it pass? which viewports?
   - `summary.json` → cost, turn count, token usage
   - `agent.jsonl` → what did the agent actually *do*?
   - `RESPONSE.md` → what does the agent *claim* it did?
3. **Diagnose** from those signals (high turn count + close-to-threshold → prompt isn't precise enough; agent stuck on one tool → tool contract unclear; etc.)
4. **Change one knob**, in this order of impact:
   - `agents/vrt/AGENTS.md` body (instructions, hard rules, iteration loop)
   - `agents/vrt/AGENTS.md` `tools:` frontmatter (add/remove capability)
   - Model (haiku probe → sonnet/opus once stable)
   - Task file `tasks/vrt/pricing/tasks/pricing.md` (clarify ambiguity)
   - Init-state scaffolding (last resort)
5. Repeat. Saturation = pass rate ≥ threshold across N runs of the same setup.

## Harness contract

To add a new harness (`ai-sdk`, `deepagents`, `claude-code` wrapper, …):

1. Create `harness/<name>/src/index.ts` that exports an async generator:

```ts
import type { HarnessParams, Message } from "../../framework.ts";

export async function* run(params: HarnessParams): AsyncIterable<Message> {
  // params: { task, systemPrompt, model, cwd, allowedTools }
  // yield Message events as they happen
  // final yield must be { t: "result", status, turnCount, totalUsage, model, costUsd? }
}
```

2. Invoke via `--harness <name>`:

```bash
bun run harness/framework.ts \
  --harness <name> \
  --agent path/to/AGENTS.md \
  --task path/to/<task>.md \
  --model <name> \
  [--verbose|-v]
```

3. Framework handles CLI parsing, agent.jsonl writing, RESPONSE.md, verbose logging. Your harness only translates between its SDK's native message stream and the standard `Message` type.

The standard `Message` types and `HarnessParams` interface are exported from `harness/framework.ts`.

## Legacy

These exist while being migrated or sunset:

| Path | Status |
| --- | --- |
| `task-runners/anthropic-sdk/` | Pre-refactor copy of the SDK harness. Superseded by `harness/anthropic-sdk/`. Keep until verified no external scripts reference it. |
| `task-runners/plan-and-find/`, `task-runners/plan-and-find-claude/`, `task-runners/plan-and-find-claude-qmd/` | Older harnesses (bash + code-graph pipelines). Predate the framework split. To migrate: extract the agent loop into `harness/<name>/src/index.ts` matching the harness contract above. |
| `environments/` | WCS env wrappers. Unused by `run_task.sh`. |
| `eval-runner/` | Old WCS-rating-style eval script. To be replaced by Pass-2 (see TODO). |
| `code-graph.zip` | Prebuilt code-graph data used by plan-and-find runs. |

## TODO

### Near-term

- **Pass-2 eval command.** A script that runs `npm run verify:visual`, parses `test-results/SUMMARY.md`, and writes `results[0].score` into `summary.json`. Without this, "did it pass?" requires reading two files. Likely lives at `harness/eval.ts`.
- **Run labels.** Optional `--label "v3-prompt"` flag on `run_task.sh` → lands in `summary.json`. Lets `jq` filter "all runs with prompt v3 across all models".
- **Model dimension in run folder.** `runs/<bench>/<task>/<model>/<guid>/` instead of flat `<guid>/`. Cleaner once you sweep models.

### Medium-term

- **`harness/diag.ts`** — common diagnostic queries over `agent.jsonl` (tool-use counts, retry detection, cost trajectory).
- **N-runs-of-same-setup.** `--n 5` flag for stochasticity sampling. Saturation = pass rate over K trials.
- **Compare-two-runs view.** `jq`-based side-by-side delta for two summary.json files.
- **`ai-sdk` harness.** Same Message contract, Vercel AI SDK underneath. Enables cross-harness comparison ("is Sonnet better under Anthropic SDK or AI SDK?").
- **`deepagents` harness.** LangChain JS DeepAgents implementation of the same contract.
- **Claude Code CLI wrapper harness.** Wraps `claude --print` as a harness; emits a minimal Message stream (no token counts but still ranked on pass/cost/time).

### Long-term (platform direction)

- **Curated showcase runs.** `runs/showcase/` (committed) vs `runs/drafts/` (gitignored). Cherry-pick representative passing/failing runs as evidence per bench.
- **Per-bench README** (`agents/vrt/README.md`) documenting the saturating setup, model-capability matrix, and reproduction command.
- **Verified-pro submission flow.** A submission = one folder containing `AGENTS.md` (+ optional `mcp-servers/`, `skills/`, `wikis/`) that drops into `agents/<bench>/` and runs against the bench's tasks under the harness contract.
- **Auto-generated leaderboard** from `runs/showcase/` summary.json: pass rate × mean cost × mean turns per (bench × task × model × competitor).
- **Held-out task variants** for judging. Public tasks for iteration; private variants for judging prevent overfitting.
- **Company-hosted private competitions.** Same framework + harness contract, gated competitor pool, IP terms set per comp.

### Cleanup

- Migrate `task-runners/plan-and-find*/` to the harness contract or retire if unused.
- Delete `task-runners/anthropic-sdk/` once it's confirmed no scripts reference it.
- Delete `environments/` if confirmed unused.
- Replace `eval-runner/` with Pass-2 script.

---

Project goal: ship saturating setups for real-world dev tasks. Track record on a public leaderboard is the demonstrated capability. The platform commercializes via verified-pro submissions and company-hosted private competitions.
