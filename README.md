# Lowgular Benchmark

High level overview of models:

- environments: used for WCS based benchmarks and it is a wrapper on top of init-states
- init-states: reusable starters for tasks can be used for agentic pipelines and WCS based benchmarks
- tasks: user messages used as tasks for benchmark
- runs: local version of the benchmark before we can push it to the backend. Folder structure is organizational only, but the real important part is to create a guid folder representing a task results (single benchmark run) in the backend
- task-runners: custom agentic pipelines that can be used to run the tasks. You can use WCS then task-runner is not needed. If you use it - make sure it produces a partial summary.json
- eval-runner: a simple runner that will take WCS rating and do pretty much the same as WCS rating logic (the category logic is done in backend not in the flow) - the idea is to append assessments to summary.json

## Running custom pipeline:

We have 2 agents here: bash and code-graph.

First of all it is recommended that you install globally code-graph so you can also play with it (but you can also wire it in via npm locally): `npm i -G @lowgular/code-graph@0.2.8`

Then you can just go to the `run` folder and appropriate sub folder (or create one) and run:

`dir=$(uuidgen | tr '[:upper:]' '[:lower:]') && mkdir "$dir" && cd "$dir"`

Then run the cli from task-runners with params
After it is done you can run eval-runner with expected param
