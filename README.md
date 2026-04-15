# Lowgular Benchmark

High level overview of models:

- environments: used for WCS based benchmarks and it is a wrapper on top of init-states
- init-states: reusable starters for tasks can be used for agentic pipelines and WCS based benchmarks
- tasks: user messages used as tasks for benchmark
- runs: local version of the benchmark before we can push it to the backend. Folder structure is organizational only, but the real important part is to create a guid folder representing a task results (single benchmark run) in the backend
- task-runners: custom agentic pipelines that can be used to run the tasks. You can use WCS then task-runner is not needed. If you use it - make sure it produces a partial summary.json
- eval-runner: a simple runner that will take WCS rating and do pretty much the same as WCS rating logic (the category logic is done in backend not in the flow) - the idea is to append assessments to summary.json

## Config

You need to setup the open router key:

```bash
export OPENROUTER_API_KEY=YOUR_KEY
```

## Running custom pipeline:

We have 2 agents here: bash and code-graph.

First of all it is recommended that you install globally code-graph so you can also play with it (but you can also wire it in via npm locally): `npm i -G @lowgular/code-graph@0.2.8`

Also we have added .code-graph in some init-states to .gitignore - but you can unzup the `code-graph.zip` and copy it to .code-graph folder in appropriate init-state

### Example: Bash vs Code Graph pipelines

Then you can just go to the `runs/agent-code-graph` folder and then:

1. Create benchmark run folder and cd to it:

```bash
dir=$(uuidgen | tr '[:upper:]' '[:lower:]') && mkdir "$dir" && cd "$dir"
```

2. Execute Task Runner

```bash
node ../../../../task-runners/plan-and-find/dist/main.js ../../../../tasks/code-graph/search-standalone-components.md ../../../../init-states/angular-nest-team-crud/ ../../../../task-runners/plan-and-find/agents/bash/AGENTS.md openai/gpt-5.3-codex
```

Note: this will create RESPONSE.md and summary.json (similar to WCS report summary)

3. Execute Eval Runner

```bash
node ../../../../eval-runner/dist/main.js ../../../../tasks/code-graph/search-standalone-components_angular-nest-team-crud.expected.json
```

Note: this will enhance summary.json with assessments data
