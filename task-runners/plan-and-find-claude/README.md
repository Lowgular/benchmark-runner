# plan-and-find-claude

Sibling of `plan-and-find/` that swaps the agent harness from deepagents+OpenRouter to **Claude Agent SDK** — runs on your `claude` subscription, no OpenRouter key needed.

Same CLI signature as `plan-and-find`. Same `AGENTS.md` files (`bash` and `code-graph` variants) used verbatim as the system prompt. Same `RESPONSE.md` + `summary.json` outputs.

## How it differs

- **Auth**: `claude` CLI's OAuth → your Pro/Max subscription. No OpenRouter key.
- **Tools**: deepagents in-process tools are replaced by the **MCP server at `../../../mcp/code-graph/`** (5 tools, names match deepagents 1:1: `list_pattern_catalog`, `search_pattern_context`, `search_constraint_context`, `search_cypher_context`, `code-graph-query`).
- **Init-state**: **not copied or mutated**. Used only as the project cwd for cypher execution. The catalog is provided to the MCP via a symlink at `<this-dir>/.code-graph -> ../../code-graph`, auto-created on first run.
- **For the bash agent**: `Bash` tool is auto-added on top of the AGENTS.md whitelist (deepagents uses `LocalShellBackend`, not in the frontmatter).

## Prerequisites

```bash
npm i -g @lowgular/code-graph@0.2.8   # the cypher executor
claude --version                       # confirm logged in
cd ../../../mcp/code-graph && bun install   # MCP deps (one-time)
cd /Users/.../benchmark-runner/task-runners/plan-and-find-claude && bun install  # runner deps
```

## Run

From any cwd you want outputs in (mirrors `plan-and-find` semantics):

```bash
mkdir /tmp/run-1 && cd /tmp/run-1

bun run /Users/grzegorz.radzio/Desktop/projects/agents/benchmark-runner/task-runners/plan-and-find-claude/src/main.ts \
  ../tasks/code-graph/search-standalone-components.md \
  ../init-states/angular-nest-team-crud \
  ../task-runners/plan-and-find/agents/code-graph/AGENTS.md \
  claude-haiku-4-5
```

Args: `<prompt-file> <init-state-dir> <agent-file> <model-name>` (relative to cwd or absolute).

`<model-name>` accepts short aliases or full model ids:

| alias | resolves to |
|-------|-------------|
| `haiku` | `claude-haiku-4-5` |
| `sonnet` | `claude-sonnet-4-6` |
| `opus` | `claude-opus-4-7` |

Pass any other string and it goes through verbatim (e.g. `claude-haiku-4-5-20251001` for a specific snapshot).

Swap `agents/code-graph/AGENTS.md` → `agents/bash/AGENTS.md` to run the bash variant.

## Override MCP location

If `agents/mcp/code-graph/` isn't a sibling of this `benchmark-runner/` repo, set:

```bash
export AGENTS_MCP_PATH=/absolute/path/to/mcp/code-graph/src/server.ts
```

## What gets written

- `RESPONSE.md` — final assistant text
- `summary.json` — `{ taskId, taskRunId, environmentId, model, runner: { id: 'claude-agent-sdk' }, pipelineId: <agent name>, elapsedMs, toolCalls[] }`

## Layout

```
plan-and-find-claude/
├── package.json        # bun + @anthropic-ai/claude-agent-sdk
├── tsconfig.json
├── .gitignore          # ignores .code-graph symlink + run outputs
├── README.md
└── src/
    └── main.ts         # the runner (single file, ~200 lines)
```

The `.code-graph` symlink is auto-created at first run (relative `→ ../../code-graph`); gitignored.
