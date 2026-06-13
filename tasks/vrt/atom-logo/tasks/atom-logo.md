---
spec_version: 1
---

# Logo (atom)

**Implement the brand logo atom exactly as shown in its snapshot.** Start by reading `README.md` — it explains the workspace: file layout, story naming, the contracts, and every verify/validate script.

## Plan

**Your execution plan ships with the task: `PLAN.md` in the workspace root.** It carries the element's measured geometry. Follow it exactly.

## What this task ships

- **`tests/stories/expected.json`** — the component inventory: one story, `atoms-logo--default`.
- **`tests/visual/atoms-logo--default/`** — the snapshot. The component must render exactly as shown, at exactly the snapshot's pixel dimensions.
- **`public/logo.svg`** — the exact vector asset from the design; use it, never redraw it.

| Story | Snapshot |
|---|---|
| `atoms-logo--default` | the brand logo |
