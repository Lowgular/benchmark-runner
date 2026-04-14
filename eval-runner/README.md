# eval-runner

Minimal TypeScript evaluator for task-run outputs.

It compares:

- expected nodes from a config (`name` + `filePath`)
- actual nodes parsed from `RESPONSE.md` `## Final Answer`

and writes recall/precision assessments into `summary.json`.

## Config format

```json
{
  "expectedNodes": [
    { "name": "AppService", "filePath": "api/src/app/app.service.ts" },
    { "name": "TeamsService", "filePath": "web/src/app/teams/teams.service.ts" }
  ]
}
```

The metric definitions live in `src/ratings/per-build`:

- `recall.metric.ts`
- `precision.metric.ts`

## Usage

```bash
npm run build
node dist/main.js <expected-config-path>
```

Example:

```bash
node dist/main.js ./expected.json
```

The runner expects `RESPONSE.md` to already exist in the current working directory.
If it is missing, it throws an error.

The runner expects `summary.json` to already exist in the current working directory.
If it is missing, it throws an error.

On success, it writes a flat `assessments` array into
`results[0].score.categories[...].assessments` using the `high-impact` category.

If `results` is missing in `summary.json`, the runner creates a minimal
`results[0]` scaffold with `promptDef` from `details.summary.taskId` and
`details.summary.prompt`.
