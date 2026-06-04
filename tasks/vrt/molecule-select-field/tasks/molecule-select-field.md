---
spec_version: 1
---

# Select Field (molecule)

Build a single molecule: a labelled select control.

## Component contract

| | |
|---|---|
| Selector | `app-select-field` |
| Story id | `molecules-select-field--default` |
| Rendered size in the default story | **exactly 242 × 66 px** |

## Visual spec

- A label above a native `<select>`-style control, total captured box 242×66 (the 242 includes the select's border anti-aliasing; design width is 240).
- Label: text `Label`, `text-base` (16px), regular weight, `neutral-900`. The label's ink top is the box top — trim leading or tune the gap so the select's top border sits **25px below the element top**.
- Select control: 240×40, `neutral-0` background, 1px `neutral-300` border, `radius-base` (8px), full width of the molecule.
- Inside the select: value text `Value` (`text-base`, `neutral-900`), 12px left padding; chevron-down icon (`neutral-900`, ~16px) at the right edge with 12px right padding, vertically centered.
- No description/help text, no focus ring in the default story.

All colors, radii, and type sizes come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate, never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **242×66 region anchored at the top-left of your story template's outermost element**. Wrap in a fixed-width container:

```ts
// molecules-select-field--default story template (shape, adjust to your API):
// <div class="w-[242px]"><app-select-field label="Label" value="Value" /></div>
```

The diff threshold for this story is relaxed (0.08) for text anti-aliasing — geometry (box position, border, radius, chevron placement) must still be right.

## Accessibility

The label must be programmatically associated with the control (`<label for>` or `aria-labelledby`) — the semantic validator enforces `input-missing-label`.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `molecules-select-field--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
