---
spec_version: 1
---

# Accordion Item (molecule)

Build a single molecule: one expandable FAQ row, rendered in its **open** state.

## Component contract

| | |
|---|---|
| Selector | `app-accordion-item` |
| Story id | `molecules-accordion-item--default` |
| Rendered size in the default story | **exactly 504 × 106 px** |

## Visual spec

- A bordered card: `neutral-0` background, 1px `neutral-300` border, `radius-base` (8px), padding 16px on all sides.
- Title row: text `Title`, `text-base` (16px), weight 600, `neutral-900`, with a chevron-up icon (`neutral-900`, ~16px) at the right edge, vertically centered with the title — chevron-up indicates the open state.
- Body (visible, open state) below the title with an 8px gap: two wrapped lines of `text-base` weight-400 `neutral-900` text, exactly this content:
  `Answer the frequently asked question in a simple sentence, a longish paragraph, or even in a list.`
- The default story renders the open/expanded state.

All colors, radii, and type sizes come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate, never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **504×106 region anchored at the top-left of your story template's outermost element**. Wrap in a fixed-width container:

```ts
// molecules-accordion-item--default story template (shape, adjust to your API):
// <div class="w-[504px]"><app-accordion-item title="Title">…body text…</app-accordion-item></div>
```

The diff threshold for this story is relaxed (0.08) for text anti-aliasing — calibrated from run data: a geometrically perfect build diffs ~0.06 on pure glyph AA for this text-dense crop — geometry (border, radius, padding, title/body placement, chevron) must still be right.

## Accessibility

An expandable row is a disclosure: the toggle should be a `<button type="button">` with `aria-expanded="true"` in the open state.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `molecules-accordion-item--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
