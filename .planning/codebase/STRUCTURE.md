# Codebase Structure

**Analysis Date:** 2026-06-04

## Directory Layout

```
benchmark-runner/
├── run_task.sh                         # Primary entry point: orchestrates a full benchmark run
├── package.json                        # Root-level deps (legacy langchain, eval tooling)
├── package-lock.json
│
├── harness/                            # Active pipeline — all harness code lives here
│   ├── framework.ts                    # CLI + streaming core; harness-agnostic
│   ├── write-summary.ts                # Pass-1 summary.json writer (reads agent.jsonl)
│   ├── tool-format.ts                  # Verbose logging helpers (ANSI, truncation)
│   ├── package.json                    # Harness shared deps (@anthropic-ai/claude-agent-sdk, ai, langchain, …)
│   ├── tsconfig.json                   # Bun/ESM TypeScript config; includes */src/**
│   ├── bun.lock
│   ├── node_modules/
│   ├── anthropic-sdk/
│   │   └── src/index.ts                # Harness plugin: @anthropic-ai/claude-agent-sdk
│   ├── ai-sdk/
│   │   └── src/index.ts                # Harness plugin: Vercel AI SDK + OpenRouter
│   └── deepagents/
│       └── src/index.ts                # Harness plugin: LangChain / LangGraph + OpenRouter
│
├── agents/                             # Agent recipes (one folder per bench)
│   └── vrt/
│       └── AGENTS.md                   # VRT agent: YAML frontmatter (name/tools/mcp) + system prompt body
│
├── tasks/                              # Task definitions: tasks/<bench>/<task>/
│   ├── vrt/
│   │   ├── pricing/
│   │   │   ├── tasks/pricing.md        # Task brief (user message given to agent)
│   │   │   ├── src/app/pricing/        # Starter scaffold overlay (optional)
│   │   │   └── tests/visual/
│   │   │       └── app-pricing--default/  # Baseline PNGs: mobile.png, tablet.png, desktop.png
│   │   └── newsletter-form/
│   │       ├── tasks/newsletter-form.md
│   │       ├── src/app/newsletter-form/
│   │       └── tests/visual/
│   ├── code-graph/                     # Legacy code-graph search tasks + expected JSON outputs
│   ├── wcs/                            # Legacy WCS component tasks
│   ├── entry/                          # Legacy entry-point tasks
│   ├── refactor/                       # Legacy refactor tasks
│   └── rules/                          # Legacy rules tasks
│
├── init-states/                        # Workspace scaffolds (rsynced into run dir at runtime)
│   ├── angular-20-storybook/           # Active: Angular 20 + Storybook + Playwright VRT verifier
│   │   ├── src/app/                    # Minimal Angular app shell
│   │   ├── src/styles/tokens.css       # Tailwind v4 @theme design tokens (read-only by agent)
│   │   ├── tests/visual/storybook.spec.ts  # VRT verifier spec (read-only by agent)
│   │   ├── playwright.config.ts        # VRT Playwright config
│   │   ├── vrt-summary-reporter.ts     # Custom reporter → test-results/SUMMARY.md
│   │   ├── package.json                # Angular + Storybook + Playwright deps
│   │   └── .storybook/                 # Storybook configuration
│   ├── angular-20-greenfield/          # Angular 20 minimal scaffold (no Storybook)
│   ├── angular-20-greenfield-hard/     # Harder variant of greenfield
│   ├── angular-20-legacy/              # Angular with legacy patterns
│   └── angular-nest-team-crud/         # Angular + NestJS full-stack CRUD scaffold
│
├── runs/                               # Per-run workspaces (mostly gitignored)
│   └── vrt/
│       └── pricing/
│           └── <guid>/                 # Full workspace: init-state + task overlay + agent outputs
│               ├── agent.jsonl         # Canonical event trace (one JSON line per Message)
│               ├── RESPONSE.md         # Final assistant text
│               ├── summary.json        # WCS-compatible run metadata (Pass-1, score=null)
│               └── test-results/       # VRT artifacts: SUMMARY.md, diff PNGs
│
├── task-runners/                       # LEGACY — superseded by harness/
│   ├── plan-and-find/                  # Pre-framework harness (bash + code-graph)
│   ├── plan-and-find-claude/           # Claude variant of above
│   └── plan-and-find-claude-qmd/       # QMD variant
│
├── environments/                       # LEGACY — WCS env wrappers, unused
│   ├── angular-20-greenfield/
│   ├── angular-20-greenfield-hard/
│   └── angular-20-legacy/
│
├── eval-runner/                        # LEGACY — old WCS-style eval; to be replaced by Pass-2
│   └── src/
│
├── code-graph/                         # Legacy: code-graph patterns, cypher, features for plan-and-find
│   ├── cypher/
│   ├── features/
│   ├── patterns/
│   └── variants/
│
├── .planning/
│   └── codebase/                       # GSD codebase map documents (this file)
│
└── node_modules/                       # Root-level deps (legacy tooling)
```

## Directory Purposes

**`harness/`:**
- Purpose: The active benchmark pipeline — framework core + harness plugins
- Contains: `framework.ts` (the only CLI entry), `write-summary.ts`, `tool-format.ts`, and one subdirectory per harness plugin
- Key files: `harness/framework.ts`, `harness/write-summary.ts`, `harness/package.json`

**`harness/<name>/src/`:**
- Purpose: One harness plugin per SDK/approach
- Contains: Single `index.ts` exporting `async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Active plugins: `anthropic-sdk`, `ai-sdk`, `deepagents`

**`agents/`:**
- Purpose: Declarative agent recipes — system prompts + tool configuration
- Contains: One subdirectory per bench; each has an `AGENTS.md` with YAML frontmatter and prompt body
- Key files: `agents/vrt/AGENTS.md`

**`tasks/`:**
- Purpose: Task definitions organized by bench and task name
- Contains: Task brief (`tasks/<bench>/<task>/tasks/<task>.md`) + optional src/tests overlays
- Key files: `tasks/vrt/pricing/tasks/pricing.md`, `tasks/vrt/newsletter-form/tasks/newsletter-form.md`

**`init-states/`:**
- Purpose: Committed workspace scaffolds rsynced into fresh run dirs
- Contains: Full Angular project trees (package.json, angular.json, src/, tests/, etc.)
- Key files: `init-states/angular-20-storybook/` (active for VRT bench)

**`runs/`:**
- Purpose: Runtime output — one GUID dir per benchmark run
- Contains: Full workspace (init-state + task overlay) + agent outputs
- Gitignored (except curated showcases if added in future)

## Key File Locations

**Entry Points:**
- `run_task.sh`: Shell orchestration; the human-facing command
- `harness/framework.ts`: Bun script; invoked by `run_task.sh`; sole CLI entry for the harness pipeline
- `harness/write-summary.ts`: Bun script; invoked by `run_task.sh` after harness exits

**Harness Plugins:**
- `harness/anthropic-sdk/src/index.ts`: Default harness (Anthropic SDK direct)
- `harness/ai-sdk/src/index.ts`: OpenRouter via Vercel AI SDK
- `harness/deepagents/src/index.ts`: OpenRouter via LangChain / LangGraph

**Configuration:**
- `harness/package.json`: All harness runtime dependencies
- `harness/tsconfig.json`: TypeScript config for harness (targets `*/src/**/*` + root .ts files)
- `init-states/angular-20-storybook/playwright.config.ts`: VRT verifier configuration
- `init-states/angular-20-storybook/package.json`: Angular + Storybook + Playwright dependencies

**Agent Recipes:**
- `agents/vrt/AGENTS.md`: Active VRT agent definition (system prompt + tools list)

**Type Definitions:**
- `harness/framework.ts`: Exports `Message`, `HarnessParams`, `AgentDef`, `Harness`, `Usage`, `McpServerConfig`

## Naming Conventions

**Files:**
- Harness framework utilities: `kebab-case.ts` (e.g. `write-summary.ts`, `tool-format.ts`)
- Harness plugins: always `src/index.ts` (conventional entry)
- Agent recipes: always `AGENTS.md` (uppercase)
- Task briefs: `<task-name>.md` (kebab-case, matches task dir name)
- Run workspaces: `<uuid-v4>/` (lowercase, generated by `uuidgen`)

**Directories:**
- Bench names: short lowercase identifiers (e.g. `vrt`, `code-graph`, `wcs`)
- Task names: kebab-case matching the task brief filename (e.g. `pricing`, `newsletter-form`)
- Harness names: kebab-case matching the `--harness` flag value (e.g. `anthropic-sdk`, `ai-sdk`, `deepagents`)
- Init-state names: `<framework>-<version>-<variant>` (e.g. `angular-20-storybook`, `angular-20-legacy`)

## Where to Add New Code

**New harness (SDK integration):**
- Create directory: `harness/<harness-name>/src/`
- Implementation: `harness/<harness-name>/src/index.ts` — export `async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Types imported from: `../../framework.ts` (relative import, `.ts` extension required for Bun)
- Register in `run_task.sh` by verifying it exists at `harness/$HARNESS_ID/src/index.ts` (automatic — no registration needed)

**New bench (task category):**
- Agent recipe: `agents/<bench-name>/AGENTS.md` (YAML frontmatter: `name`, `description`, `tools`, optional `mcpServers`)
- Wire init-state mapping in `run_task.sh` case statement (`run_task.sh:37-46`)
- Task definitions: `tasks/<bench-name>/<task-name>/tasks/<task-name>.md` + optional overlays

**New task (for existing bench):**
- Task directory: `tasks/<bench>/<task-name>/`
- Task brief: `tasks/<bench>/<task-name>/tasks/<task-name>.md`
- Optional starter scaffold: `tasks/<bench>/<task-name>/src/app/<component-name>/`
- Optional baselines: `tasks/<bench>/<task-name>/tests/visual/<story-id>/{mobile,tablet,desktop}.png`

**New init-state:**
- Directory: `init-states/<framework>-<version>-<variant>/`
- Must include `.gitignore` (controls what rsync excludes via `--filter=":- .gitignore"`)
- Wire in `run_task.sh` case statement for the appropriate bench

**Utilities shared across harnesses:**
- Add to `harness/tool-format.ts` (logging/formatting) or `harness/framework.ts` (types/CLI)
- Export from `harness/framework.ts` — harnesses import types only from there

## Special Directories

**`runs/`:**
- Purpose: Live benchmark run workspaces; one GUID subdir per invocation
- Generated: Yes (by `run_task.sh`)
- Committed: No (gitignored; exception possible for `runs/showcase/` in future)

**`harness/node_modules/`:**
- Purpose: Harness runtime dependencies (separate package from root)
- Generated: Yes (`npm install` or `bun install` inside `harness/`)
- Committed: No

**`init-states/angular-20-storybook/node_modules/`:**
- Purpose: Angular/Storybook/Playwright deps for the init-state scaffold
- Generated: Yes (rsynced or npm-installed at run time)
- Committed: No

**`init-states/angular-20-storybook/storybook-static/`:**
- Purpose: Pre-built Storybook static output (for seeding runs without full build)
- Generated: Yes (`npm run build-storybook`)
- Committed: Partially (appears committed in init-state for faster run setup)

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by planning and execution agents
- Generated: Yes (by GSD `/gsd-map-codebase` command)
- Committed: Yes

---

*Structure analysis: 2026-06-04*
