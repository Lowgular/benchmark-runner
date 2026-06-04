# External Integrations

**Analysis Date:** 2026-06-04

## APIs & External Services

**Anthropic (Claude):**
- Claude models (`claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`) - Core AI inference
  - SDK/Client: `@anthropic-ai/claude-agent-sdk` ^0.2.121
  - Auth: `ANTHROPIC_API_KEY` (consumed implicitly by the SDK from the environment)
  - Used by: `harness/anthropic-sdk/src/index.ts`, `task-runners/plan-and-find-claude/src/main.ts`, `task-runners/plan-and-find-claude-qmd/src/main.ts`
  - Entry point: `query()` from `@anthropic-ai/claude-agent-sdk` with `permissionMode: "bypassPermissions"`

**OpenRouter:**
- Multi-model gateway enabling non-Anthropic models - Used by `ai-sdk` and `deepagents` harnesses and the `plan-and-find` task runner
  - SDK/Client: `@openrouter/ai-sdk-provider` (Vercel AI SDK harness), `@langchain/openrouter` (`plan-and-find`), `@langchain/openai` with custom `baseURL: "https://openrouter.ai/api/v1"` (`deepagents` harness)
  - Auth: `OPENROUTER_API_KEY` env var — required by `harness/ai-sdk/src/index.ts` and `harness/deepagents/src/index.ts`
  - Model IDs mapped: `claude-haiku-4-5` → `anthropic/claude-haiku-4.5`, `claude-sonnet-4-6` → `anthropic/claude-sonnet-4.5`, `claude-opus-4-7` → `anthropic/claude-opus-4.5`

## MCP (Model Context Protocol) Servers

**Code-graph MCP server (stdio):**
- Purpose: Exposes `list_pattern_catalog`, `search_pattern_context`, `search_constraint_context`, `search_cypher_context`, `code-graph-query` tools to the agent
- Transport: `stdio` (subprocess spawned via Bun)
- Default path: `<repo>/../mcp/code-graph/src/server.ts` (overridable via `AGENTS_MCP_PATH`)
- Env vars forwarded: `MCP_CATALOG_DIR` (catalog directory), `MCP_PROJECT_DIR` (project root)
- Used by: `task-runners/plan-and-find-claude/src/main.ts`

**Code-graph QMD MCP server (stdio):**
- Purpose: Exposes `nl2intent`, `intent2cypher`, `code-graph-query` tools (query-with-metadata variant)
- Default path: `<agents-root>/code-graph/apps/mcp/code-graph-qmd/src/server.ts` (overridable via `AGENTS_MCP_PATH`)
- Env vars forwarded: `MCP_KB_DIR` (knowledge-base dir, overridable via `MCP_KB_DIR`), `MCP_PROJECT_DIR`
- Used by: `task-runners/plan-and-find-claude-qmd/src/main.ts`

**Generic MCP server support:**
- The harness framework (`harness/framework.ts`) accepts arbitrary `mcpServers` from agent YAML frontmatter
- `harness/ai-sdk/src/index.ts` spawns stdio MCP clients using `@modelcontextprotocol/sdk`
- `harness/deepagents/src/index.ts` uses `@langchain/mcp-adapters` `MultiServerMCPClient`

## Data Storage

**Databases:**
- None - no database is used; all persistence is flat-file

**File Storage:**
- Local filesystem only
- Run outputs written to `runs/<bench>/<task>/<guid>/` per task execution
- Output files per run: `agent.jsonl` (streaming trace), `RESPONSE.md` (final assistant text), `summary.json` (WCS-compatible metadata + score)
- Init-state directories under `init-states/` are synced into run workdirs via `rsync`

**Caching:**
- Angular build cache: `init-states/angular-20-storybook/.angular/cache/` (local, not committed)

## Authentication & Identity

**Auth Provider:**
- None (no user auth system)
- API keys for LLM providers passed as environment variables:
  - `ANTHROPIC_API_KEY` - for Anthropic direct access (Claude Agent SDK)
  - `OPENROUTER_API_KEY` - for OpenRouter model gateway (ai-sdk and deepagents harnesses)

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Harness writes structured JSONL to `<run-dir>/agent.jsonl` — one JSON line per `Message` event (user, assistant, thinking, tool_use, tool_result, result, error)
- `framework.ts` writes `summary.json` from the final `{ t: "result" }` event it streamed; `write-summary.ts` (regen tool) can rebuild it from `agent.jsonl` for historical runs
- Console output to stderr for progress; stdout for content
- VRT summary written to `test-results/SUMMARY.md` by the custom Playwright reporter (`vrt-summary-reporter.ts`)

## CI/CD & Deployment

**Hosting:**
- Local execution only — no cloud deployment
- No CI pipeline detected

**Run orchestration:**
- Entry point: `run_task.sh` (Bash) at repo root
- Usage: `./run_task.sh <bench> <task> <model> [--harness=<name>]`
- Validates harness env (`--check-env`), creates GUID workdir, rsyncs init-state, runs `npm ci`, overlays task files, invokes `bun run harness/framework.ts` (which writes agent.jsonl, RESPONSE.md, summary.json)

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Environment Configuration

**Required env vars by harness:**

| Var | Required by | Purpose |
|-----|-------------|---------|
| `ANTHROPIC_API_KEY` | `anthropic-sdk` harness, `plan-and-find-claude*` runners | Anthropic API auth (implicit to SDK) |
| `OPENROUTER_API_KEY` | `ai-sdk` harness, `deepagents` harness | OpenRouter API auth |
| `AGENTS_MCP_PATH` | `plan-and-find-claude`, `plan-and-find-claude-qmd` | Override default MCP server `.ts` path |
| `MCP_KB_DIR` | `plan-and-find-claude-qmd` | Override default knowledge-base directory |

**Secrets location:**
- No secrets files committed; must be set in the calling shell environment

## Local Tooling Integrations

**Angular + Storybook (VRT benchmark environment):**
- Storybook 10.3.6 builds to `storybook-static/` and is served by `http-server` on port 6006
- Playwright 1.50.0 captures screenshots at 3 viewports and diffs against baselines in `tests/visual/<story-id>/`
- Diff threshold: `maxDiffPixelRatio: 0.02` (2%)

**Lowgular internal packages (local file references):**
- `@lowgular/wcs-ratings`: `file:../../../../lowgular-internal/dist/apps/wcs-ratings` — linked from a sibling repository on the developer's machine
- `@lowgular/code-graph` 0.2.8 — published npm package for code-graph tooling

**web-codegen-scorer** ^0.0.61:
- Published npm package; declared at root; provides scoring/ratings primitives for benchmark evaluation

---

*Integration audit: 2026-06-04*
