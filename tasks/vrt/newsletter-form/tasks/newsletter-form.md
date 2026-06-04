# Newsletter Page

> As a marketing-site visitor, I want a clear way to subscribe to the newsletter so I can receive weekly updates.

Build the newsletter signup page **as a small design system** — atoms → molecules → layouts → page — not as one monolithic component. Components are named for their design-system role, never for this page's context.

## Component inventory (the contract)

| Level | Component | Selector | Story id(s) | Spec |
|---|---|---|---|---|
| Atom | Heading | `app-heading` | `atoms-heading--default` | Semantic heading with a `level` property (1–6) controlling tag and type scale. Used here at level 1. |
| Atom | Text | `app-text` | `atoms-text--overline` `atoms-text--lead` `atoms-text--small` | Typographic atom with a `variant` property: `overline` (small, uppercase, letter-spaced, brand color), `lead` (muted, larger, comfortable reading width), `body` (default), `small` (fine print, muted). |
| Atom | Input | `app-input` | `atoms-input--default` | Text input. Neutral border, visible focus state, placeholder support. |
| Atom | Button | `app-button` | `atoms-button--primary` | Solid brand-color button. |
| Molecule | Input Group | `app-input-group` | `molecules-input-group--default` | Input + button composed as a form row: inline side-by-side ≥640px, stacked full-width <640px. Owns the form semantics. |
| Layout | Section | `app-section` | `layouts-section--centered` | Width-constrained content column with a `centered` property: horizontally centers the child stack, center-aligns text, owns the vertical rhythm between children. No content of its own. |
| Page | Newsletter | `app-newsletter` | `pages-newsletter--default` *(baselined)* | Composes everything below inside the Section. Soft light-neutral background (not pure white); content vertically and horizontally centered in the viewport. |

Properties beyond those listed are optional — scaffold quality (semantic HTML, token usage, structure a frontend developer could finish) matters more than API surface.

## Page content (top to bottom, centered)

1. **Overline** — `Newsletter` (Text, `overline` variant)
2. **Heading** — `Stay in the loop` (Heading, level 1)
3. **Lead** — *"Get a short weekly digest of the best new tools, libraries, and posts — curated and delivered straight to your inbox."* (Text, `lead` variant)
4. **Form** — email input with placeholder `you@company.com` + `Subscribe` button (Input Group)
5. **Privacy note** — *"We respect your inbox. Unsubscribe anytime."* (Text, `small` variant)

## Verification & scoring

- `npm run verify:stories` — every story id above must be registered and render without errors. Each one counts.
- `npm run verify:visual` — the page story must match the baselines at mobile 375×812, tablet 768×1024, desktop 1280×800 (≤ 2% pixel diff each). **This is weighted highest.**
- Baselines: `tests/visual/pages-newsletter--default/{mobile,tablet,desktop}.png`

## Functional requirements

- Use correct semantic HTML
   - Use correct form elements including type attribute for inputs and buttons
- Meet highest Accessibility standards
- Use modern Angular.
- Use only the tokens defined in `src/styles/tokens.css` (via the Tailwind utilities they generate).
   - No hardcoded hex / `rgb` / `oklch`, no arbitrary Tailwind values like `bg-[#abc]`, no inline `style=`.
