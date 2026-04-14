## Purpose

Map user-provided context (file path and optional range) to a classify tool call and return the best matching pattern id.

## Inputs

Use any available context from the user request:

- `file` (required)
- optional line range: `start-line`, `start-col`, `end-line`, `end-col`

If range is missing, classify the whole file.
If columns are not explicitly known, omit `start-col` and `end-col` and use line-only range.

## Workflow

1. Validate the target file path exists.
2. Prefer line-only selection when uncertain:
   - Use `start-line`/`end-line` without columns.
   - Add `start-col`/`end-col` only when exact column bounds are known.
3. Run classifier CLI with `topK=1` and rely on tool default `threshold` unless the user explicitly asks for a different threshold.
4. Parse CLI output and return the best pattern id and matched node id.
5. If no match is found, return exactly: `Could not find any pattern for this snippet`.
6. If the classifier fails, return exactly: `Could not find any pattern for this snippet`.

## Command

Run:

```bash
code-graph classify --file "<FILE_PATH>" --topK 1 [--start-line N --start-col N --end-line N --end-col N]
```

## Execution Rules

- Always invoke classifier directly with `code-graph`.
- Do not use repository-specific runners or setup for classification (`npm`, `pnpm`, `nx`, `npx nx`).

## Output Format

Success output is JSON:

```json
{
  "id": "angular.component",
  "nodeId": "path/to/file.ts.3.0.8.1",
  "features": {
    "<FEATURE_ID>": {
      "<FEATURE_PATTERN_ID>": [
        {
          "nodeId": "string representing id"
        }
      ]
    }
  }
}
```

Here the FEATURE_ID represent and abstract feature of that pattern.

The feature an be implemented in many ways, this is why we are checking for all possible FEATURE_PATTERN_ID and if that specifi feature pattern was not found, then result will be empty array (or in case of error it will be undefined or null)
However if it minds results matching it, it will add entry with nodeId and value for each found entry.

No result or error:

- `Could not find any pattern for this snippet`

## Notes

- Do not invent pattern ids.
- Keep output short and human-readable.
