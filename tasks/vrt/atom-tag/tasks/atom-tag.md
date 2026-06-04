---
spec_version: 1
---

# Tag (atom)

Build a single atom: the design system's Tag badge.

## Component contract

| | |
|---|---|
| Selector | `app-tag` |
| Story id | `atoms-tag--default` |
| Rendered size in the default story | **exactly 44 × 32 px** |

## Visual spec

- Inline badge that shrink-wraps its content.
- Background `success-100`, text color `success-900`.
- Corner radius `radius-base` (8px).
- Label text `Tag`, `text-base` (16px), regular weight, line-height 24px.
- Padding: 4px top/bottom, 8px left/right (→ 32px total height with the 24px line).
- No border, no shadow, no icon.

All colors, radii, and type sizes come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate (e.g. `bg-success-100`, `text-success-900`, `rounded-base`), never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **44×32 region anchored at the top-left of your story template's outermost element**. The Tag shrink-wraps, so the template's outermost element should be the tag itself (give the host `inline-block`/`inline-flex` display so it wraps tight):

```ts
// atoms-tag--default story template (shape, adjust to your component API):
// <app-tag>Tag</app-tag>
```

If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges — fix sizing first, pixels second.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `atoms-tag--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
