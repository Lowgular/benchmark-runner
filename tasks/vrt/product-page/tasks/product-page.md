---
spec_version: 1
---

# Product Page

> As a shopper, I want a product detail section that shows me an image, the product name, its category tag, price, configuration options, and a purchase button, so I can understand the product and configure my order on a single focused page.

Build the product page section **as a small design system** — atoms → molecules → layouts → page — not as one monolithic component. Components are named for their design-system role, never for this page's context.

## Component inventory (the contract)

| Level | Component | Selector | Story id(s) | Spec |
|---|---|---|---|---|
| Atom | Image | `app-image` | `atoms-image--default` | Rectangular image placeholder. Solid neutral-200 background fill. Full width and height of its container; no fixed aspect ratio baked into the component (the parent controls sizing). Contains a centered image icon (SVG or Unicode placeholder) to indicate it is an image slot. |
| Atom | Icon Button | `app-icon-button` | `atoms-icon-button--default` | Circular icon-only button. 36×36px. neutral-800 background, neutral-100 icon, radius-full. Used here with a heart/favorite SVG icon. Positioned as an absolute overlay on the top-left of the Image. Padding 8px on all sides. |
| Atom | Tag | `app-tag` | `atoms-tag--default` | Inline badge. success-100 background, success-900 text, radius-base, text-base font, padding 4px 8px. Displays a short category label (e.g. "Tag"). |
| Atom | Price | `app-price` | `atoms-price--default` | Price display. Shows a currency symbol at text-2xl weight-700 (neutral-900) next to a large numeric amount at text-5xl weight-700 (neutral-900). The two parts sit inline on the same baseline. |
| Atom | Button | `app-button` | `atoms-button--default` | Full-width action button. neutral-800 background, neutral-100 text, radius-base, text-base font, height 40px, padding 12px top/bottom. |
| Molecule | Select Field | `app-select-field` | `molecules-select-field--default` | Labelled select control. A label text (text-base, neutral-900) above a select element. Select: neutral-0 background, neutral-300 border (1px), radius-base, 40px height, padding 12px left, full width. Chevron-down icon on the right edge (neutral-900). No description text. |
| Molecule | Accordion Item | `app-accordion-item` | `molecules-accordion-item--default` | Single expandable FAQ row. neutral-100 background, neutral-300 border (1px), radius-base, padding 16px. Title row: text-base weight-600 (neutral-900) + chevron-up icon (neutral-900) on the right, indicating open state. Body: text-base weight-400 (neutral-900) below the title when open. Default story renders the open (expanded) state. |
| Page | Product | `app-product` | `pages-product--default` *(baselined)* | Composes all of the above inside a two-column section. White (neutral-0) background. At desktop (≥1200px): Image fills the left column (roughly half width), all other elements stack in the right column. At mobile (<640px): Image spans full width on top, all other elements stack below. Column gap 64px desktop, 0 mobile. Section horizontal padding 64px desktop, 24px mobile. Inside the right column, top-to-bottom order: Heading text (text-2xl, weight-600, neutral-900), [Tag + Price on the same row], description body text (text-base, weight-400, neutral-500), two Select Fields side-by-side desktop / stacked mobile (gap 24px desktop, 16px mobile), Button full-width, one Accordion Item. Column gap between these groups 24px. |

Properties beyond those listed are optional — scaffold quality (semantic HTML, token usage, structure a frontend developer could finish) matters more than API surface.

## Page content (top to bottom, right column)

1. **Heading** — `Text Heading` (`app-heading` or inline heading, text-2xl weight-600, neutral-900)
2. **Tag** — `Tag` (Tag atom, success-100 bg / success-900 text, beside the Price)
3. **Price** — `$50` (Price atom: `$` at text-2xl weight-700 + `50` at text-5xl weight-700, neutral-900)
4. **Description** — `Text` (body text-base weight-400, neutral-500 color)
5. **Select Field (1)** — `Label` / `Value` (Select Field molecule)
6. **Select Field (2)** — `Label` / `Value` (Select Field molecule)
7. **Button** — `Button` (Button atom, full-width, neutral-800 bg)
8. **Accordion Item** — `Title` / `Answer the frequently asked question in a simple sentence, a longish paragraph, or even in a list.` (Accordion Item molecule, open/expanded state)

Left column: Image placeholder (neutral-200 bg) with Icon Button (heart, neutral-800 bg, radius-full) absolutely positioned top-left, offset 8px from top and left edges of the image.

## Breakpoints

Exactly two breakpoints: mobile (375px) and desktop (1200px). No intermediate viewport.

| Viewport | Width | Layout |
|---|---|---|
| Mobile | 375px | Single-column stacked: Image full-width on top, right-column content below. Section padding 24px. Select Fields stacked vertically (gap 16px). |
| Desktop | 1200px | Two-column side-by-side: Image left ≈ 42% width, content right ≈ 42% width, gap 64px. Section padding 64px. Select Fields side-by-side (gap 24px). |

## Verification & scoring

Each script below runs as an independent `npm run <script>` command inside the agent workspace.

- `npm run verify:stories` — every story id in the Component inventory must be registered and render without errors.
- `npm run verify:visual` — the page story must match the baselines at mobile (375×812) and desktop (1200×800) within the per-task threshold (hand-set after first submissions).
  - Baselines: `tests/visual/pages-product--default/mobile.png` and `tests/visual/pages-product--default/desktop.png`
- `npm run verify:structure` — the component selectors listed in the inventory must be present in the rendered page story DOM.
- `npm run validate:a11y` — axe-core scan of all rendered stories; reports WCAG violations with selector and remediation hints.
- `npm run validate:semantic` — HTML landmarks, heading hierarchy, form label association, and no div-soup.
- `npm run validate:tailwind` — bans arbitrary Tailwind values (`bg-[#abc]`, `p-[13px]`), inline styles, and oversized HTML.

Thresholds are per-task, hand-set after first submissions; per-story overrides are available.

## Functional requirements

- Use correct semantic HTML throughout (e.g. `<button>` for Icon Button and Button, `<select>` for Select, `<details>`/`<summary>` or equivalent pattern for Accordion).
- Meet highest accessibility standards: button labels (even icon-only buttons need `aria-label`), form labels associated with controls, heading hierarchy coherent, decorative icons marked `aria-hidden="true"`.
- Use modern Angular: standalone components, `ChangeDetectionStrategy.OnPush`, `signal()` for state, `@if`/`@for` control flow, `app-` selector prefix.
- Use only the tokens defined in `src/styles/tokens.css` via the Tailwind utilities they generate.
  - No hardcoded `#abc` / `rgb(...)` / `oklch(...)`. No arbitrary Tailwind values like `bg-[#abc]` or `p-[13px]`. No inline `style=` or `[style]=`.
- Responsive layout must work using only Tailwind's responsive prefix classes (e.g. `md:flex-row`) — no media queries in component stylesheets.
