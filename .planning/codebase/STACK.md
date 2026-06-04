# Technology Stack

**Analysis Date:** 2026-06-04

## Languages

**Primary:**
- TypeScript 5.7–5.9 - All harness, task-runner, and eval-runner source code
- Bash - Orchestration shell script (`run_task.sh`)

**Secondary:**
- TypeScript ~5.8.3 - Angular init-state frontend (`init-states/angular-20-storybook/`)

## Runtime

**Environment:**
- Node.js v25.9.0 (system)
- Bun 1.3.13 - primary runtime for harness and `plan-and-find-claude` / `plan-and-find-claude-qmd` task runners

**Package Manager:**
- npm 11.12.1 (root workspace, `eval-runner`, `plan-and-find` runner, init-states)
- Bun (harness, `plan-and-find-claude`, `plan-and-find-claude-qmd`)
- Lockfiles: `package-lock.json` present at root, harness, and several sub-packages; `bun.lock` at harness and bun-based runners

## Module System

- Harness and bun-based runners: `"type": "module"` (ESM)
- `plan-and-find` task runner and `eval-runner`: `"type": "commonjs"`

## Frameworks

**Agent / AI:**
- `@anthropic-ai/claude-agent-sdk` ^0.2.121 - Core SDK for the `anthropic-sdk` and `plan-and-find-claude*` harnesses; exposes the `query()` streaming agent loop
- `@langchain/langgraph` ^1.0.0 - ReAct agent loop for the `deepagents` harness
- `@langchain/core` ^1.1.36 - LangChain message primitives used across harness and `plan-and-find` runner
- `deepagents` ^1.9.0 - High-level agent abstraction built on LangChain (`createDeepAgent`, `LocalShellBackend`) used in `plan-and-find` task runner
- `ai` (Vercel AI SDK) ^5.0.0 - `streamText` + MCP tool bridge for the `ai-sdk` harness

**LLM Provider Adapters:**
- `@langchain/openai` ^1.0.0 - OpenAI-compatible client pointed at OpenRouter, used in `deepagents` harness
- `@langchain/openrouter` ^0.2.2 - Native OpenRouter LangChain provider for `plan-and-find` runner
- `@openrouter/ai-sdk-provider` ^1.0.0 - OpenRouter adapter for Vercel AI SDK, used in `ai-sdk` harness

**MCP (Model Context Protocol):**
- `@langchain/mcp-adapters` ^1.0.0 - Bridges MCP stdio servers into LangChain/LangGraph tools
- `@modelcontextprotocol/sdk` (via `ai-sdk` harness) - Direct MCP client for Vercel AI SDK harness

**Frontend (init-state):**
- Angular 20.1.x - Standalone components, `ChangeDetectionStrategy.OnPush`, `signal()` state
- Storybook 10.3.6 (`@storybook/angular`) - Component development and screenshot source
- Tailwind CSS v4 + PostCSS - Styling via design tokens (`@theme`)
- RxJS ~7.8.0 - Reactive primitives

**Testing (init-state):**
- Playwright ^1.50.0 + `@playwright/test` - Visual regression testing (screenshot capture + diff)
- `pixelmatch` ^7.1.0 + `pngjs` ^7.0.0 - Pixel-level image comparison in VRT

**Validation / Type safety:**
- Zod ^3.23.0 / ^4.1.8 - Runtime schema validation in harness and `plan-and-find` runner
- `yaml` ^2.6.0 - YAML frontmatter parsing in `harness/framework.ts`

**Build:**
- `tsc` (TypeScript compiler) - Compiles `eval-runner` and `plan-and-find` runner to CommonJS dist
- Angular CLI ^20.1.1 / `@angular/build` ^20.1.1 - Builds Angular app and Storybook static

**Code Quality (init-state):**
- ESLint 9.x + `angular-eslint` ^20.0.0 + `typescript-eslint` ^8.20.0
- Stylelint 16.x + `stylelint-config-standard`

## Key Dependencies

**Critical:**
- `@anthropic-ai/claude-agent-sdk` ^0.2.121 - Used directly by the two `plan-and-find-claude*` runners and the `anthropic-sdk` harness; the primary way Claude models are invoked in the benchmark
- `deepagents` ^1.9.0 - Powers the `plan-and-find` task runner's agentic loop; also declared as a root-level dependency
- `@lowgular/code-graph` 0.2.8 - Code-graph knowledge base tooling referenced at root; local peer `@lowgular/wcs-ratings` linked from a sibling repo
- `web-codegen-scorer` ^0.0.61 - Scoring/ratings library referenced at root level

**Infrastructure:**
- `http-server` ^14.1.1 - Serves `storybook-static` on port 6006 during Playwright VRT runs
- `@compodoc/compodoc` ^1.1.26 - Documentation generation for the Angular init-state

## Configuration

**Environment:**
- No `.env` files checked in; secrets are passed via shell environment
- Key runtime env vars consumed by code (see INTEGRATIONS.md)
- `AGENTS_MCP_PATH` - overrides default path to MCP server binary
- `MCP_KB_DIR` - overrides default knowledge-base directory path (qmd runner)

**Build:**
- `harness/tsconfig.json` - Targets ES2022 / NodeNext; `"types": ["bun"]`; no emit
- `task-runners/plan-and-find/tsconfig.app.json` - Targets `es2015`; `moduleResolution: "node"`; emits to `dist/`
- `eval-runner/tsconfig.json` - CommonJS emit to `dist/`
- `init-states/angular-20-storybook/tsconfig.json` - Angular project references setup
- `init-states/angular-20-storybook/playwright.config.ts` - VRT config; viewport: desktop 1280×800; `maxDiffPixelRatio: 0.02`; serves Storybook on port 6006

## Platform Requirements

**Development:**
- Node.js ≥ 25 and Bun ≥ 1.3 required to run harness scripts
- npm ≥ 11 for init-state installs
- Angular CLI available globally or via npx

**Production:**
- No server deployment; the repo is a local benchmark runner
- Each task run creates a GUID-named directory under `runs/<bench>/<task>/`
- Init-state is `rsync`'d into the run directory; `npm ci` is executed per run

---

*Stack analysis: 2026-06-04*
