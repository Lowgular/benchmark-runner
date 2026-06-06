---
spec_version: 1
---

# Footer (layout)

**Implement the footer exactly as shown in the snapshots**, as an atomic composition. The executable contracts define the task:

- **`tests/stories/expected.json`** — the component inventory: one story per component (3 atoms, 2 molecules, 1 layout). The structure verifier additionally requires the rendered footer story to compose the lower-level components in its DOM.
- **`tests/visual/<story-id>/`** — the snapshots. Each component must render exactly as its snapshot, at exactly the snapshot's pixel dimensions.
- **`tests/validate/expected-tokens.json`** — the required design-token bindings per story.
- **`public/`** — the exact vector assets from the design (brand logo + 4 social icons). Use them; never redraw them.

What each snapshot shows:

| Story | Snapshot |
|---|---|
| `atoms-link--default` | one text link (`UI design`) |
| `atoms-logo--default` | the brand logo |
| `atoms-social-icon-link--default` | one icon-only link (the X icon) |
| `molecules-social-links--default` | the social row — X, Instagram, YouTube, LinkedIn |
| `molecules-link-column--default` | the `Use cases` column — heading + 7 links |
| `layouts-footer--default` | the full footer — desktop (1200) and mobile (375) |
