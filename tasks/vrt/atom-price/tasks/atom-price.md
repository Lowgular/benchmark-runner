---
spec_version: 1
---

# Price (atom)

Build a single atom: the design system's price display. This is a pure-typography atom — the visual contract is glyph ink, so expect to iterate against the diff to nail vertical alignment.

## Component contract

| | |
|---|---|
| Selector | `app-price` |
| Story id | `atoms-price--default` |
| Rendered size in the default story | **exactly 76 × 41 px** |

## Visual spec

- Displays a currency symbol and an amount inline, sharing one baseline: `$` then `50`.
- `$`: `text-2xl` (24px), weight 700, `neutral-900`.
- `50`: `text-5xl` (48px), weight 700, `neutral-900`.
- The 76×41 box is **ink-tight**: the cap-top of `50` touches the box top, the shared baseline sits at the box bottom (no descenders). The smaller `$` starts ~9px below the box top, bottom on the same baseline.
- Trim line-height leading (`leading-none` and a fixed-height container help) so the captured region holds only glyph ink — default line boxes add empty space above/below and will show as a vertical offset in the diff.

All colors and type sizes come from the design tokens in `src/styles/tokens.css` — use the Tailwind utilities they generate (e.g. `text-neutral-900`), never raw hex values.

## Story setup (required for visual verification)

The visual verifier screenshots a **76×41 region anchored at the top-left of your story template's outermost element**. The template's outermost element should be the price itself, shrink-wrapped (`inline-flex` host):

```ts
// atoms-price--default story template (shape, adjust to your component API):
// <app-price currency="$" amount="50" />
```

The diff threshold for this story is relaxed (0.06) for glyph anti-aliasing — alignment and sizes must still be right. A solid band of diff at top or bottom means your line-height leading is leaking into the box.

## Verification

Run the gate scripts after each change (see workflow):

- `npm run verify:stories` — the story id `atoms-price--default` must exist and render
- `npm run verify:visual` — pixel diff vs the committed baseline
- `npm run verify:structure` — passes trivially (no page-level story in this task)

Then polish with the validators: `npm run validate:a11y`, `npm run validate:semantic`, `npm run validate:tailwind`.

The component must follow the project's atomic-design conventions: standalone Angular component, `ChangeDetectionStrategy.OnPush`, file layout per the workspace README.
