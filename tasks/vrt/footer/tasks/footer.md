---
spec_version: 1
---

# Footer (layout)

**Implement the footer exactly as shown in the snapshots**, as an atomic composition. Start by reading `README.md` — it explains the workspace: file layout, story naming, the contracts, and every verify/validate script.

## Plan

**Your execution plan ships with the task: `PLAN.md` in the workspace root.** It lists every component in build order with its measured geometry. Follow it exactly, top to bottom.

## What this task ships

- **`tests/stories/expected.json`** — the component inventory: one story per component (3 atoms, 2 molecules, 1 layout). The structure verifier requires the rendered footer story to compose the lower-level components in its DOM.
- **`tests/visual/<story-id>/`** — the snapshots. Each component must render exactly as its snapshot, at exactly the snapshot's pixel dimensions.
- **`tests/validate/expected-tokens.json`** — the required design-token bindings per story.
- **Vector assets in `public/`** — the exact SVGs from the design; use them, never redraw them:
  - `public/logo.svg` — the brand logo
  - `public/icons/x.svg`, `public/icons/instagram.svg`, `public/icons/youtube.svg`, `public/icons/linkedin.svg` — the social icons

What each snapshot shows:

| Story | Snapshot |
|---|---|
| `atoms-link--default` | one text link (`UI design`) |
| `atoms-logo--default` | the brand logo |
| `atoms-social-icon-link--default` | one icon-only link (the X icon) |
| `molecules-social-links--default` | the social row — X, Instagram, YouTube, LinkedIn |
| `molecules-link-column--default` | the `Use cases` column — heading + 7 links |
| `layouts-footer--default` | the full footer — desktop (1200) and mobile (375) |
