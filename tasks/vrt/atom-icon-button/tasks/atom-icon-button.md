---
spec_version: 1
---

# Icon Button (atom)

Build a single atom: the design system's circular icon-only button.

## Component contract

| | |
|---|---|
| Selector | `app-icon-button` |
| Story id | `atoms-icon-button--default` |
| Rendered size in the default story | **exactly 36 × 36 px** |

## Visual spec

- Circular icon-only button, exactly 36×36px.
- Background `neutral-800`, radius `radius-full`.
- Padding 8px on all sides → 20×20px icon area.
- Icon: a filled heart (favorite) SVG, color `neutral-100`, centered. Use a conventional filled-heart shape (two lobes, point at the bottom) drawn to fill the 20×20 area.
- No border, no shadow, no text.

All colors and radii come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate (e.g. `bg-neutral-800`, `rounded-full`), never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **36×36 region anchored at the top-left of your story template's outermost element**. The component is its own box — the template's outermost element should be the icon button itself (host `inline-block`/`inline-flex` so it wraps tight):

```ts
// atoms-icon-button--default story template (shape, adjust to your component API):
// <app-icon-button></app-icon-button>
```

The diff threshold for this story is relaxed (0.10) because the exact heart glyph outline is approximated — geometry (circle size, icon placement, colors) must still be exact. If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges.

## Accessibility

Icon-only buttons need an accessible name — provide one (e.g. `aria-label="Add to favorites"`).

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `atoms-icon-button--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
