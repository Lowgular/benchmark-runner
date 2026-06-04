---
spec_version: 1
---

# Button (atom)

Build a single atom: the design system's action Button.

## Component contract

| | |
|---|---|
| Selector | `app-button` |
| Story id | `atoms-button--default` |
| Rendered size in the default story | **exactly 504 × 40 px** |

## Visual spec

- Full-width block button: fills 100% of its container's width; height exactly 40px.
- Background `neutral-800`, text color `neutral-100`.
- Corner radius `radius-base` (8px).
- Label text `Button`, `text-base` (16px), regular weight, horizontally and vertically centered.
- No border, no shadow, no icon.

All colors, radii, and type sizes come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate (e.g. `bg-neutral-800`, `rounded-base`), never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **504×40 region anchored at the top-left of your story template's outermost element**. Wrap the component in a fixed-width container so that element measures exactly 504×40:

```ts
// atoms-button--default story template (shape, adjust to your component API):
// <div class="w-[504px]"><app-button>Button</app-button></div>
```

If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges — fix sizing first, pixels second.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `atoms-button--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
