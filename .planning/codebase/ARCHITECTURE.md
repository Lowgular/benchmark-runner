<!-- refreshed: 2026-06-04 -->
# Architecture

**Analysis Date:** 2026-06-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         run_task.sh                                  │
│                  (Orchestration Entry Point)                          │
│  bench + task + model + harness → GUID run dir setup + invocations  │
└──────────────┬──────────────────────────────────────────────────────┘
               │  bun run harness/framework.ts --harness <name>
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    harness/framework.ts                              │
│         (CLI + file I/O layer; never changes per harness)            │
│  Parses args → reads agents/*.md + tasks/**/*.md → dynamic-imports  │
│  harness plugin → streams Message events → writes agent.jsonl +     │
│  RESPONSE.md + summary.json                                          │
└────────┬───────────────────────────────────────────────────────────┘
         │  dynamic import: harness/<name>/src/index.ts
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Harness Plugin  (async generator)                      │
├───────────────┬────────────────────┬────────────────────────────────┤
│  anthropic-sdk │      ai-sdk        │         deepagents             │
│ claude-agent-  │ Vercel AI SDK +    │  LangChain JS / LangGraph +    │
│    sdk         │ OpenRouter         │  OpenRouter                    │
│ harness/       │ harness/           │  harness/                      │
│ anthropic-sdk/ │ ai-sdk/            │  deepagents/                   │
│ src/index.ts   │ src/index.ts       │  src/index.ts                  │
└────────┬───────┴────────────────────┴────────────────────────────────┘
         │ yields Message events
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Run Workspace                                │
│              runs/<bench>/<task>/<guid>/                             │
│  agent.jsonl  RESPONSE.md  summary.json  test-results/              │
│                                                                      │
│  summary.json (Pass-1) written by framework.ts from the final       │
│  result event — WCS shape: results[].score = null until Pass-2 eval │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `run_task.sh` | Orchestration: GUID dir setup, rsync init-state, npm install, overlay task, invoke framework (with `--run-id`/`--init-state`) | `run_task.sh` |
| `framework.ts` | CLI parsing, reads agent/task files, resolves model aliases, dynamic-imports harness, streams + writes agent.jsonl / RESPONSE.md / summary.json | `harness/framework.ts` |
| `anthropic-sdk` harness | Agent loop via `@anthropic-ai/claude-agent-sdk`; translates SDK stream to standard Message events | `harness/anthropic-sdk/src/index.ts` |
| `ai-sdk` harness | Agent loop via Vercel AI SDK + OpenRouter; spawns MCP servers via `@modelcontextprotocol/sdk` | `harness/ai-sdk/src/index.ts` |
| `deepagents` harness | Agent loop via LangChain JS `createReactAgent` + OpenRouter; wires MCP via `@langchain/mcp-adapters` | `harness/deepagents/src/index.ts` |
| `write-summary.ts` | Standalone regen tool: rebuilds `summary.json` for an existing run from its agent.jsonl (shares `buildSummary` from `harness/summary.ts`) | `harness/write-summary.ts` |
| `summary.ts` | Shared `buildSummary()` — single source of truth for the WCS-compatible Pass-1 shape | `harness/summary.ts` |
| `tool-format.ts` | Verbose logging helpers: ANSI colors, tool_use/tool_result formatting, truncation | `harness/tool-format.ts` |
| `agents/vrt/AGENTS.md` | Recipe definition: YAML frontmatter (name, tools, MCP servers) + body = system prompt for the agent | `agents/vrt/AGENTS.md` |
| `init-states/angular-20-storybook/` | Workspace scaffold rsynced into each run dir; contains Angular 20 + Storybook + Playwright VRT verifier | `init-states/angular-20-storybook/` |
| `tasks/vrt/<task>/` | Task overlay: task brief markdown + optional src/tests overlays applied on top of init-state | `tasks/vrt/pricing/`, `tasks/vrt/newsletter-form/` |

## Pattern Overview

**Overall:** Plugin-based pipeline with a stable framework core and swappable harness implementations

**Key Characteristics:**
- The framework (`framework.ts`) is harness-agnostic; all SDK-specific logic lives in separate plugin modules
- Communication between framework and harness uses a standardized streaming `Message` union type
- Run isolation: each run gets a fresh GUID directory populated via rsync from a committed init-state
- Two-pass evaluation model: Pass-1 (run metadata + usage) written by `framework.ts` from the final `result` event; Pass-2 (score) not yet automated
- Agent recipes defined as Markdown files with YAML frontmatter (`agents/*/AGENTS.md`) — decoupled from code

## Layers

**Orchestration Layer:**
- Purpose: Sets up the per-run workspace, sequences setup steps, invokes the pipeline
- Location: `run_task.sh`
- Contains: Bash scripting, rsync, npm install, framework invocation, write-summary invocation
- Depends on: `harness/framework.ts`, `harness/write-summary.ts`, `init-states/`, `tasks/`, `agents/`
- Used by: Human operator / CI

**Framework Layer:**
- Purpose: CLI, file I/O, logging, streaming — everything except the agent loop
- Location: `harness/framework.ts`
- Contains: CLI arg parsing, YAML frontmatter parsing, model alias resolution, agent.jsonl writer, RESPONSE.md writer, verbose log dispatcher
- Depends on: Harness plugin (dynamic import), `harness/tool-format.ts`
- Used by: `run_task.sh` (via `bun run`)

**Harness Plugin Layer:**
- Purpose: SDK-specific agent loop — translates native SDK stream to standard Message events
- Location: `harness/<name>/src/index.ts`
- Contains: Single exported `async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Depends on: `harness/framework.ts` (types only — `HarnessParams`, `Message`, `Usage`)
- Used by: `harness/framework.ts` (dynamic import)

**Data Layer (run artifacts):**
- Purpose: Persistent output of each benchmark run
- Location: `runs/<bench>/<task>/<guid>/`
- Contains: `agent.jsonl`, `RESPONSE.md`, `summary.json`, `test-results/`
- Generated by: framework + write-summary + agent-invoked npm scripts

**Recipe / Config Layer:**
- Purpose: Declarative definitions of agents, tasks, and workspace scaffolds
- Location: `agents/`, `tasks/`, `init-states/`
- Contains: AGENTS.md files (system prompts + tool lists), task Markdown briefs, Angular/Storybook workspace templates

## Data Flow

### Primary Benchmark Run

1. Operator invokes `./run_task.sh vrt pricing sonnet` (`run_task.sh:14-113`)
2. Shell creates `runs/vrt/pricing/<guid>/` and rsyncs `init-states/angular-20-storybook/` into it (`run_task.sh:72`)
3. Shell runs `npm install` in run dir, then rsyncs `tasks/vrt/pricing/` overlay (`run_task.sh:75-78`)
4. Shell invokes `bun run harness/framework.ts --harness anthropic-sdk --agent agents/vrt/AGENTS.md --task tasks/vrt/pricing/tasks/pricing.md --model sonnet --run-id <guid> --init-state <dir>` (`run_task.sh`)
5. `framework.ts` parses CLI, reads agent YAML frontmatter → `AgentDef`, reads task text, resolves `sonnet` → `claude-sonnet-4-6`
6. Framework dynamic-imports `harness/anthropic-sdk/src/index.ts` and calls `run(params)`
7. Harness yields `Message` events; framework appends each to `agent.jsonl` as a JSON line (live, one per event)
8. Harness yields final `{ t: "result", status, turnCount, totalUsage, model, costUsd }` event; framework captures it
9. Framework writes `RESPONSE.md` with final assistant text
10. Framework writes `runs/vrt/pricing/<guid>/summary.json` from the captured `result` event via `buildSummary()` (`harness/summary.ts`) — no second process, no re-parse of agent.jsonl

### VRT Evaluation Flow (agent-driven, within a run)

1. Agent invokes `npm run verify:visual` (bash tool) inside the run workspace
2. Playwright spec at `tests/visual/storybook.spec.ts` builds Storybook, boots http-server on :6006, captures screenshots at 3 viewports
3. Screenshots diffed against baseline PNGs at `tests/visual/<story-id>/<viewport>.png` (ratio ≤ 0.02)
4. `vrt-summary-reporter.ts` writes `test-results/SUMMARY.md` (per-viewport pass/fail + diff ratios)
5. Agent reads `test-results/SUMMARY.md` and diff PNGs; iterates on component code until all 3 viewports pass

**State Management:**
- No shared in-memory state across runs; all state is filesystem-based inside the GUID run dir
- `agent.jsonl` is the canonical trace — append-only, one JSON line per Message event
- `summary.json` is the authoritative run record (read by any downstream tooling)

## Key Abstractions

**`Message` union type:**
- Purpose: Standard event type yielded by every harness; consumed by framework for logging and file writing
- Location: `harness/framework.ts:40-47`
- Pattern: Discriminated union on `t` field (`"user"`, `"assistant"`, `"thinking"`, `"tool_use"`, `"tool_result"`, `"result"`, `"error"`)

**`HarnessParams` interface:**
- Purpose: Typed input to every harness's `run()` function
- Location: `harness/framework.ts`
- Fields: `task`, `systemPrompt`, `model`, `cwd`, `allowedTools`, `mcpServers`, `secrets`

**`requiredEnv` / `optionalEnv` plugin exports:**
- Purpose: Declarative env dependencies — plugin states what it needs; framework resolves from `process.env`, validates fail-fast, and delivers via `params.secrets`. Plugins never touch `process.env`.
- Examples: `harness/ai-sdk/src/index.ts` (`requiredEnv = ["OPENROUTER_API_KEY"]`), `harness/anthropic-sdk/src/index.ts` (`optionalEnv = ["ANTHROPIC_API_KEY"]` — SDK can also use Claude Code OAuth)

**`AgentDef` interface:**
- Purpose: Parsed representation of an AGENTS.md file
- Location: `harness/framework.ts:70-76`
- Parsed from: YAML frontmatter (`name`, `description`, `tools`, `mcpServers`) + body (system prompt)

**`Harness` type:**
- Purpose: Contract for all harness plugin implementations
- Location: `harness/framework.ts:66`
- Signature: `(params: HarnessParams) => AsyncIterable<Message>`

**Init-state:**
- Purpose: Reproducible workspace snapshot rsynced into each run dir
- Examples: `init-states/angular-20-storybook/`, `init-states/angular-20-greenfield/`, `init-states/angular-20-legacy/`
- Pattern: Full Angular project committed to repo; `.gitignore` controls what rsync excludes

**Task overlay:**
- Purpose: Task-specific files (task brief, baseline PNGs, starter component scaffolds) applied on top of init-state
- Examples: `tasks/vrt/pricing/`, `tasks/vrt/newsletter-form/`
- Structure: `tasks/<bench>/<task>/tasks/<task>.md` (brief) + optional `src/`, `tests/visual/` dirs

## Entry Points

**`run_task.sh`:**
- Location: `run_task.sh`
- Triggers: Human operator / CI; accepts `<bench> <task> <model> [--harness=<name>]`
- Responsibilities: Full run lifecycle — workspace setup, npm install, framework invocation, write-summary invocation

**`harness/framework.ts`:**
- Location: `harness/framework.ts`
- Triggers: `bun run harness/framework.ts --harness <name> --agent <file> --task <file> --model <name>`
- Responsibilities: CLI parsing, file I/O, streaming pipeline, agent.jsonl + RESPONSE.md writing

**`harness/write-summary.ts`:**
- Location: `harness/write-summary.ts`
- Triggers: manual — regen tool for historical runs only (normal runs get summary.json from framework.ts)
- Responsibilities: Reads agent.jsonl of an existing run, rebuilds WCS-compatible summary.json via shared `buildSummary()`

## Architectural Constraints

- **Runtime:** Bun (not Node.js directly) — harness and framework use `#!/usr/bin/env bun` shebang; tsconfig targets `"bun"` types
- **ESM only:** `"type": "module"` in `harness/package.json`; all imports use `.ts` extensions (Bun resolves them natively)
- **Single-threaded event loop:** Each harness run is a single async generator; no worker threads
- **Filesystem isolation:** Each run is isolated in its own GUID directory; no shared mutable state between runs
- **No circular imports:** `harness/<name>/src/index.ts` imports types from `../../framework.ts` only; framework dynamic-imports harness
- **Harness contract boundary:** Harness plugins must NOT do file I/O, CLI parsing, or logging — only yield Message events

## Anti-Patterns

### Bypassing the `Message` stream for file output

**What happens:** A harness writes files (agent.jsonl, RESPONSE.md) directly inside its `run()` generator
**Why it's wrong:** Duplicates framework responsibility; breaks the single source of truth for traces
**Do this instead:** Yield only `Message` events from `harness/<name>/src/index.ts`; let `harness/framework.ts` own all file I/O
**Enforced by:** `harness/harness-contract.test.ts` (`bun test harness/`) — fails on fs imports, `process.argv`, `process.env`, `console.*`, or non-type framework imports in any plugin

### Adding CLI parsing to a harness plugin

**What happens:** `harness/<name>/src/index.ts` reads `process.argv` directly
**Why it's wrong:** Framework owns all CLI; harness receives fully-resolved `HarnessParams`
**Do this instead:** Add any new parameters to `HarnessParams` in `harness/framework.ts` and pass them via the contract

### Modifying init-state scaffold files during a task

**What happens:** Agent edits `package.json`, `playwright.config.ts`, `angular.json`, etc. in the run workspace
**Why it's wrong:** Scaffold is read-only by contract (enforced in agent prompt); tampering is penalized in eval
**Do this instead:** Only edit files under `src/app/<name>/` as specified by the task overlay

## Error Handling

**Strategy:** Errors surface as `{ t: "error", message }` events in the Message stream; harness exits with `status: "error"` in the final `result` event; `run_task.sh` captures the exit code and propagates it

**Patterns:**
- Missing env vars (e.g. `OPENROUTER_API_KEY`) → immediate error + result events yielded, generator returns
- SDK-level errors caught with `try/catch` around the main stream loop → error event yielded, `status = "error"` in result
- Framework-level failures (missing agent file, bad CLI args) → `process.exit(1)` with message to stderr

## Cross-Cutting Concerns

**Logging:** `stderr` used for progress/status messages (`console.error`); `stdout` reserved for any piped output. Verbose mode enabled via `--verbose|-v` flag; dispatched in `harness/framework.ts:164-193` using `harness/tool-format.ts` helpers
**Validation:** CLI arg validation in `framework.ts` parseArgs; file existence checks before processing; harness entry path validated before dynamic import
**Authentication:** API keys injected via environment variables (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`); never passed as CLI args. Plugins declare needs via `requiredEnv`/`optionalEnv` exports; `framework.ts` is the only module reading `process.env`, validates fail-fast (also pre-setup via `--check-env` in `run_task.sh`), and scrubs secret values from `agent.jsonl`/`RESPONSE.md` before writing

---

*Architecture analysis: 2026-06-04*
