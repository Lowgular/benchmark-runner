## Purpose

Fetch available variants for the classified root pattern id.

## Input

- `patternId` (required): root pattern id returned from the classify command.

## Command

Run:

```bash
code-graph variants --pattern-id "<PATTERN_ID>"
```

## Output

The command returns markdown in this format:

```md
# Available Variants:

id: <VARIANT_ID>

<variant content markdown>

---
```

Each variant contains covariance/requirements that should be compared with already computed features from pattern classification.

If no variants exist for a pattern id, output is:

- `No variants found for this pattern.`
