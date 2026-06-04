<!-- GSD:project-start source:PROJECT.md -->
## Project

**VRT Benchmark — Angular UI Craft Benchmark**

A benchmark that demonstrates modern LLM agents (starting with Sonnet/Opus via the Anthropic SDK) can build pixel-perfect, accessible, well-structured Angular UIs from a written spec — the kind of UI work normally handed off from Figma. The product is the benchmark itself: task specs, an in-loop verifier suite, a reliable agent harness, and eventually a multi-model/multi-harness leaderboard.

**Core Value:** A task spec + verifier feedback loop good enough that even weaker models (Haiku) can produce pixel-perfect, accessible, atomically-structured Angular UI — proving the spec/loop, not the model, is the bottleneck.

### Constraints

- **Tech stack**: Angular 20 standalone + Storybook 10 + Playwright VRT in init-state; Bun + TypeScript harness — already established, working
- **Verifier interface**: CLI scripts inside the init-state workspace — works identically across all 3 harnesses, no per-harness MCP wiring
- **Models**: Start with Anthropic (Sonnet/Opus, then Haiku as the bar); OpenRouter harnesses enable other models in stage 2
- **Atomic design**: enforced and verified — component structure is scored, not just the rendered pixels
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7–5.9 - All harness, task-runner, and eval-runner source code
- Bash - Orchestration shell script (`run_task.sh`)
- TypeScript ~5.8.3 - Angular init-state frontend (`init-states/angular-20-storybook/`)
## Runtime
- Node.js v25.9.0 (system)
- Bun 1.3.13 - primary runtime for harness and `plan-and-find-claude` / `plan-and-find-claude-qmd` task runners
- npm 11.12.1 (root workspace, `eval-runner`, `plan-and-find` runner, init-states)
- Bun (harness, `plan-and-find-claude`, `plan-and-find-claude-qmd`)
- Lockfiles: `package-lock.json` present at root, harness, and several sub-packages; `bun.lock` at harness and bun-based runners
## Module System
- Harness and bun-based runners: `"type": "module"` (ESM)
- `plan-and-find` task runner and `eval-runner`: `"type": "commonjs"`
## Frameworks
- `@anthropic-ai/claude-agent-sdk` ^0.2.121 - Core SDK for the `anthropic-sdk` and `plan-and-find-claude*` harnesses; exposes the `query()` streaming agent loop
- `@langchain/langgraph` ^1.0.0 - ReAct agent loop for the `deepagents` harness
- `@langchain/core` ^1.1.36 - LangChain message primitives used across harness and `plan-and-find` runner
- `deepagents` ^1.9.0 - High-level agent abstraction built on LangChain (`createDeepAgent`, `LocalShellBackend`) used in `plan-and-find` task runner
- `ai` (Vercel AI SDK) ^5.0.0 - `streamText` + MCP tool bridge for the `ai-sdk` harness
- `@langchain/openai` ^1.0.0 - OpenAI-compatible client pointed at OpenRouter, used in `deepagents` harness
- `@langchain/openrouter` ^0.2.2 - Native OpenRouter LangChain provider for `plan-and-find` runner
- `@openrouter/ai-sdk-provider` ^1.0.0 - OpenRouter adapter for Vercel AI SDK, used in `ai-sdk` harness
- `@langchain/mcp-adapters` ^1.0.0 - Bridges MCP stdio servers into LangChain/LangGraph tools
- `@modelcontextprotocol/sdk` (via `ai-sdk` harness) - Direct MCP client for Vercel AI SDK harness
- Angular 20.1.x - Standalone components, `ChangeDetectionStrategy.OnPush`, `signal()` state
- Storybook 10.3.6 (`@storybook/angular`) - Component development and screenshot source
- Tailwind CSS v4 + PostCSS - Styling via design tokens (`@theme`)
- RxJS ~7.8.0 - Reactive primitives
- Playwright ^1.50.0 + `@playwright/test` - Visual regression testing (screenshot capture + diff)
- `pixelmatch` ^7.1.0 + `pngjs` ^7.0.0 - Pixel-level image comparison in VRT
- Zod ^3.23.0 / ^4.1.8 - Runtime schema validation in harness and `plan-and-find` runner
- `yaml` ^2.6.0 - YAML frontmatter parsing in `harness/framework.ts`
- `tsc` (TypeScript compiler) - Compiles `eval-runner` and `plan-and-find` runner to CommonJS dist
- Angular CLI ^20.1.1 / `@angular/build` ^20.1.1 - Builds Angular app and Storybook static
- ESLint 9.x + `angular-eslint` ^20.0.0 + `typescript-eslint` ^8.20.0
- Stylelint 16.x + `stylelint-config-standard`
## Key Dependencies
- `@anthropic-ai/claude-agent-sdk` ^0.2.121 - Used directly by the two `plan-and-find-claude*` runners and the `anthropic-sdk` harness; the primary way Claude models are invoked in the benchmark
- `deepagents` ^1.9.0 - Powers the `plan-and-find` task runner's agentic loop; also declared as a root-level dependency
- `@lowgular/code-graph` 0.2.8 - Code-graph knowledge base tooling referenced at root; local peer `@lowgular/wcs-ratings` linked from a sibling repo
- `web-codegen-scorer` ^0.0.61 - Scoring/ratings library referenced at root level
- `http-server` ^14.1.1 - Serves `storybook-static` on port 6006 during Playwright VRT runs
- `@compodoc/compodoc` ^1.1.26 - Documentation generation for the Angular init-state
## Configuration
- No `.env` files checked in; secrets are passed via shell environment
- Key runtime env vars consumed by code (see INTEGRATIONS.md)
- `AGENTS_MCP_PATH` - overrides default path to MCP server binary
- `MCP_KB_DIR` - overrides default knowledge-base directory path (qmd runner)
- `harness/tsconfig.json` - Targets ES2022 / NodeNext; `"types": ["bun"]`; no emit
- `task-runners/plan-and-find/tsconfig.app.json` - Targets `es2015`; `moduleResolution: "node"`; emits to `dist/`
- `eval-runner/tsconfig.json` - CommonJS emit to `dist/`
- `init-states/angular-20-storybook/tsconfig.json` - Angular project references setup
- `init-states/angular-20-storybook/playwright.config.ts` - VRT config; viewport: desktop 1280×800; `maxDiffPixelRatio: 0.02`; serves Storybook on port 6006
## Platform Requirements
- Node.js ≥ 25 and Bun ≥ 1.3 required to run harness scripts
- npm ≥ 11 for init-state installs
- Angular CLI available globally or via npx
- No server deployment; the repo is a local benchmark runner
- Each task run creates a GUID-named directory under `runs/<bench>/<task>/`
- Init-state is `rsync`'d into the run directory; `npm ci` is executed per run
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- TypeScript source files: `kebab-case.ts` in harness and eval-runner (`framework.ts`, `tool-format.ts`, `write-summary.ts`, `node-match.utils.ts`)
- Metric files follow the `<name>.metric.ts` suffix pattern: `precision.metric.ts`, `recall.metric.ts`
- Angular components use `<name>.component.ts` / `<name>.component.html` / `<name>.component.scss`
- Angular services use `<name>.service.ts`
- Angular entity files use `<name>.entity.ts`
- Angular model/type files use `<name>.model.ts`, `<name>.ts`
- Angular DTO files use `<name>.dto.ts` under `dto/` subdirectories
- Angular UI state files use `<name>.ui-state.ts`
- Angular stories files use `<name>.stories.ts`
- Shell scripts: `run_task.sh` (kebab-case with `.sh` extension)
- camelCase for all functions and variables (both harness and eval-runner)
- Functions are lowercase camelCase: `parseArgs`, `resolveModel`, `logMessage`, `normalizeNode`, `readLastResult`
- Constants at module level: UPPER_SNAKE_CASE for fixed lookup tables (`MODEL_ALIASES`, `PLAN_AND_FIND_TOOL_IDS`), camelCase for runtime values
- Private class fields in Angular: camelCase, declared with `private readonly` when possible
- `PascalCase` for all interfaces, types, classes, and enums
- Discriminated union members use single-letter tag field: `{ t: "user" | "assistant" | ... }` (see `Message` type in `harness/framework.ts`)
- Exported types use `export type` syntax (not `export interface`) in harness code
- NestJS DTOs and entities use classes with decorators
- Component selectors: `app-<kebab-name>` (e.g., `app-teams-page`)
- Inject pattern: use `inject()` function (not constructor injection) in standalone components — see `TeamsPageComponent` and `TeamsService`
- NestJS API layer still uses constructor injection: `constructor(private readonly teamsService: TeamsService) {}`
## Code Style
- Prettier is used in the `angular-nest-team-crud` init state: `{ "singleQuote": true }`
- Harness TypeScript files use double quotes consistently
- Angular/NestJS init states use single quotes (enforced by Prettier config)
- Trailing commas present in multi-line function arguments and object literals
- 2-space indentation throughout TypeScript
- Harness `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`
- Eval-runner `tsconfig.json`: `strict: true`, `forceConsistentCasingInFileNames: true`
- Non-null assertions (`!`) used on TypeScript class fields to satisfy strict mode: `id!: number`, `name!: string`
- ESLint with `@nx/eslint-plugin` in the `angular-nest-team-crud` init state
- `@nx/enforce-module-boundaries` rule enforced
- No custom ESLint rules in the harness/eval-runner packages (no config found at root level)
## Import Organization
- No custom `@/` aliases detected; imports use relative paths throughout (`../../framework.ts`, `./types.js`)
- Eval-runner uses `.js` extensions on relative imports for CommonJS compatibility: `import { NodeMatch } from "../types.js"`
- Harness: ESM (`"type": "module"`, `"module": "NodeNext"`, `.ts` extensions in imports allowed via Bun)
- Eval-runner: CommonJS (`"type": "commonjs"`, standard Node module resolution, `.js` extensions required)
- Angular init states: Standard Angular module/ESM
## Error Handling
- Framework-level: throw `Error` objects with descriptive messages at validation boundaries, then catch in `main()` with `process.exit(1)`:
- Harness generators: yield `{ t: "error", message }` events rather than throwing, allowing the framework to log and continue:
- Unknown error coercion: always check `instanceof Error` before `.message`, else `String(err)`:
- `finally` for resource cleanup in generators (`toolset.close()`, `mcpClient.close()`)
- NestJS services throw `NotFoundException` from `@nestjs/common` for missing resources
- Angular components set `this.errorMessage` string from Observable `.error` callbacks (no global error handler)
## Logging
- Framework uses ANSI color codes via the `C` helper in `harness/tool-format.ts` — conditionally enabled only when `process.stdout.isTTY` is true
- Operational messages go to `stderr` to not pollute stdout data pipeline: `console.error(`harness: ${args.harness}`)`
- Eval-runner diagnostic messages: `console.log` (no color)
- task-runner messages: `console.log` with plain text prefixes
## Comments
- Module-level JSDoc block comments used consistently at the top of each harness implementation to describe purpose, dependencies, and env requirements
- Inline comments used for non-obvious branching logic or SDK quirks
- Private method doc comments used for contract explanation: `/** Links existing rows by name or creates new MemberEntity rows — internal persistence only. */`
- Block comment at top of most harness files (`/** ... */` style) describing the file's role
- No `@param`/`@returns` annotations — comments are narrative prose
- Type annotations carry the contract; comments add context about "why"
## Function Design
- Generators return `AsyncGenerator<Message>` — never throw from within, always yield error events
- Pure utility functions return the computed value directly
- Void functions declared with `: void` return type
## Module Design
- Each harness exports a single `run` function as named export: `export async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Eval-runner rating modules export named constants (e.g., `precisionMetric`, `recallMetric`)
- Shared types and interfaces are exported from dedicated type files (`types.ts`, `rating-types.ts`)
- `eval-runner/src/ratings/per-build/index.ts` used as barrel for per-build rating aggregation
- No barrel `index.ts` files in harness packages — direct file imports used
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| `run_task.sh` | Orchestration: env preflight (`--check-env`), GUID dir setup, rsync init-state, npm ci, overlay task, invoke framework (with `--run-id`/`--init-state`) | `run_task.sh` |
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
- The framework (`framework.ts`) is harness-agnostic; all SDK-specific logic lives in separate plugin modules
- Communication between framework and harness uses a standardized streaming `Message` union type
- Run isolation: each run gets a fresh GUID directory populated via rsync from a committed init-state
- Two-pass evaluation model: Pass-1 (run metadata + usage) written by `framework.ts` from the final `result` event; Pass-2 (score) not yet automated
- Agent recipes defined as Markdown files with YAML frontmatter (`agents/*/AGENTS.md`) — decoupled from code
## Layers
- Purpose: Sets up the per-run workspace, sequences setup steps, invokes the pipeline
- Location: `run_task.sh`
- Contains: Bash scripting, env preflight, rsync, npm ci, framework invocation
- Depends on: `harness/framework.ts`, `init-states/`, `tasks/`, `agents/`
- Used by: Human operator / CI
- Purpose: CLI, file I/O, logging, streaming — everything except the agent loop
- Location: `harness/framework.ts`
- Contains: CLI arg parsing, YAML frontmatter parsing, model alias resolution, agent.jsonl writer, RESPONSE.md writer, verbose log dispatcher
- Depends on: Harness plugin (dynamic import), `harness/tool-format.ts`
- Used by: `run_task.sh` (via `bun run`)
- Purpose: SDK-specific agent loop — translates native SDK stream to standard Message events
- Location: `harness/<name>/src/index.ts`
- Contains: Single exported `async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Depends on: `harness/framework.ts` (types only — `HarnessParams`, `Message`, `Usage`)
- Used by: `harness/framework.ts` (dynamic import)
- Purpose: Persistent output of each benchmark run
- Location: `runs/<bench>/<task>/<guid>/`
- Contains: `agent.jsonl`, `RESPONSE.md`, `summary.json`, `test-results/`
- Generated by: framework + write-summary + agent-invoked npm scripts
- Purpose: Declarative definitions of agents, tasks, and workspace scaffolds
- Location: `agents/`, `tasks/`, `init-states/`
- Contains: AGENTS.md files (system prompts + tool lists), task Markdown briefs, Angular/Storybook workspace templates
## Data Flow
### Primary Benchmark Run
### VRT Evaluation Flow (agent-driven, within a run)
- No shared in-memory state across runs; all state is filesystem-based inside the GUID run dir
- `agent.jsonl` is the canonical trace — append-only, one JSON line per Message event
- `summary.json` is the authoritative run record (read by any downstream tooling)
## Key Abstractions
- Purpose: Standard event type yielded by every harness; consumed by framework for logging and file writing
- Location: `harness/framework.ts:40-47`
- Pattern: Discriminated union on `t` field (`"user"`, `"assistant"`, `"thinking"`, `"tool_use"`, `"tool_result"`, `"result"`, `"error"`)
- Purpose: Typed input to every harness's `run()` function
- Location: `harness/framework.ts`
- Fields: `task`, `systemPrompt`, `model`, `cwd`, `allowedTools`, `mcpServers`, `secrets`
- Purpose: Declarative env dependencies — plugin states what it needs; framework resolves from `process.env`, validates fail-fast, and delivers via `params.secrets`. Plugins never touch `process.env`.
- Examples: `harness/ai-sdk/src/index.ts` (`requiredEnv = ["OPENROUTER_API_KEY"]`), `harness/anthropic-sdk/src/index.ts` (`optionalEnv = ["ANTHROPIC_API_KEY"]` — SDK can also use Claude Code OAuth)
- Purpose: Parsed representation of an AGENTS.md file
- Location: `harness/framework.ts:70-76`
- Parsed from: YAML frontmatter (`name`, `description`, `tools`, `mcpServers`) + body (system prompt)
- Purpose: Contract for all harness plugin implementations
- Location: `harness/framework.ts:66`
- Signature: `(params: HarnessParams) => AsyncIterable<Message>`
- Purpose: Reproducible workspace snapshot rsynced into each run dir
- Examples: `init-states/angular-20-storybook/`, `init-states/angular-20-greenfield/`, `init-states/angular-20-legacy/`
- Pattern: Full Angular project committed to repo; `.gitignore` controls what rsync excludes
- Purpose: Task-specific files (task brief, baseline PNGs, starter component scaffolds) applied on top of init-state
- Examples: `tasks/vrt/pricing/`, `tasks/vrt/newsletter-form/`
- Structure: `tasks/<bench>/<task>/tasks/<task>.md` (brief) + optional `src/`, `tests/visual/` dirs
## Entry Points
- Location: `run_task.sh`
- Triggers: Human operator / CI; accepts `<bench> <task> <model> [--harness=<name>]`
- Responsibilities: Full run lifecycle — env preflight, workspace setup, npm ci, framework invocation
- Location: `harness/framework.ts`
- Triggers: `bun run harness/framework.ts --harness <name> --agent <file> --task <file> --model <name>`
- Responsibilities: CLI parsing, file I/O, streaming pipeline, agent.jsonl + RESPONSE.md writing
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
### Adding CLI parsing to a harness plugin
### Modifying init-state scaffold files during a task
## Error Handling
- Missing env vars (e.g. `OPENROUTER_API_KEY`) → immediate error + result events yielded, generator returns
- SDK-level errors caught with `try/catch` around the main stream loop → error event yielded, `status = "error"` in result
- Framework-level failures (missing agent file, bad CLI args) → `process.exit(1)` with message to stderr
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
