---
spec_version: 1
---

# Image (atom)

Build a single atom: the design system's image placeholder.

## Component contract

| | |
|---|---|
| Selector | `app-image` |
| Story id | `atoms-image--default` |
| Rendered size in the default story | **exactly 504 × 735 px** |

## Visual spec

- Rectangular image placeholder. Fills 100% of its container's width and height — no aspect ratio baked into the component (the parent controls sizing).
- Background `neutral-200`, no radius, no border.
- Centered image-placeholder glyph: a rounded-square picture outline containing a circle (sun) at the upper right and a mountain/diagonal landscape line, drawn as strokes slightly darker than the background (use `neutral-300`). The glyph is large — roughly 320px wide, centered both axes.
- No text.

All colors come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate (e.g. `bg-neutral-200`), never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **504×735 region anchored at the top-left of your story template's outermost element**. Wrap the component in a fixed-size container:

```ts
// atoms-image--default story template (shape, adjust to your component API):
// <div class="w-[504px] h-[735px]"><app-image /></div>
```

The diff threshold for this story is relaxed (0.08) because the exact glyph outline is approximated — the background fill, dimensions, and glyph placement/scale must still be right. If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `atoms-image--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
