---
spec_version: 1
---

# Footer (layout)

Build a site footer as an atomic composition — three atoms, two molecules, one layout. Every piece has its own story and its own pixel baseline; the footer layout story is additionally verified at two breakpoints (desktop 1200 and mobile 375) **and must compose the smaller components in its DOM** (the structure verifier checks for their selectors inside the rendered footer).

## Assets (provided in `public/`)

| File | Intrinsic size | Use |
|---|---|---|
| `/logo.svg` | 27 × 39 | brand logo (stroke-drawn, `neutral-900`) |
| `/icons/x.svg` | 24 × 24 | X (Twitter) |
| `/icons/instagram.svg` | 24 × 24 | Instagram |
| `/icons/youtube.svg` | 24 × 18 | YouTube — render inside a 24 × 24 box, vertically centered |
| `/icons/linkedin.svg` | 24 × 24 | LinkedIn |

These are the exact vectors from the design — use them via `<img>` (or inline), never redraw them.

## Component contracts

| Component | Selector | Story id | Rendered size in the default story |
|---|---|---|---|
| Link | `app-link` | `atoms-link--default` | **exactly 69 × 16 px** |
| Logo | `app-logo` | `atoms-logo--default` | **exactly 27 × 39 px** |
| Social Icon Link | `app-social-icon-link` | `atoms-social-icon-link--default` | **exactly 24 × 24 px** |
| Social Links | `app-social-links` | `molecules-social-links--default` | **exactly 144 × 24 px** |
| Link Column | `app-link-column` | `molecules-link-column--default` | **exactly 143 × 267 px** |
| Footer | `app-footer` | `layouts-footer--default` | desktop **exactly 1200 × 468 px**, mobile **exactly 375 × 919 px** |

## Design tokens (CSS variables)

Every visual value in this design maps to a token in `src/styles/tokens.css` (the Tailwind `@theme`). Use the Tailwind utilities the tokens generate — never raw hex, never arbitrary values.

The color/background/border bindings below are **machine-checked**: `tests/validate/expected-tokens.json` declares them per story, and `npm run validate:tokens` asserts the computed styles of what you render bind to exactly those tokens.

| Design value | CSS variable | Tailwind utility |
|---|---|---|
| text & icon ink `#1e1e1e` | `--color-neutral-900` | `text-neutral-900` |
| top border `#d9d9d9` | `--color-neutral-300` | `border-neutral-300` |
| background `#ffffff` | `--color-neutral-0` | `bg-neutral-0` |
| body & heading size 16px | `--text-base` | `text-base` (weight 400 links, 600 headings) |
| font | `--font-sans` (Inter) | default |
| icon gap 16px | `--spacing` × 4 | `gap-4` |
| footer padding 32px | `--spacing` × 8 | `p-8` / `pt-8` / `px-8` |
| desktop bottom padding 160px | `--spacing` × 40 | `pb-40` |

The spacing scale is a 4px grid (`--spacing: 0.25rem`) — all gaps and paddings in this design are multiples of it (e.g. an 18px row gap is `gap-4.5`, a 14px one `gap-3.5`).

## Visual spec

### Link (atom)
- A plain text link: `text-base` (16px) weight 400, `neutral-900`, no underline. Default story text: `UI design`.
- The baseline is **ink-tight** (69 × 16): the glyph ink fills the box edge to edge. Use `leading-none` so the line box equals the font size — a solid band of diff at top or bottom means your line-height leading is leaking into the box.

### Logo (atom)
- `<img src="/logo.svg">` at its intrinsic 27 × 39. Needs an `alt`.

### Social Icon Link (atom)
- An icon-only anchor, 24 × 24. Default story renders the X icon (`/icons/x.svg`). Icon-only links need an `aria-label`.

### Social Links (molecule)
- A row of four Social Icon Links in this order: X, Instagram, YouTube, LinkedIn.
- 24 × 24 icon boxes with a **16px gap** → total exactly 144 × 24.

### Link Column (molecule)
- A heading + a list of Links, stacked. Default story: heading `Use cases`, then seven links — `UI design`, `UX design`, `Wireframing`, `Diagramming`, `Brainstorming`, `Online whiteboard`, `Team collaboration`.
- Heading: `text-base` (16px) weight 600, `neutral-900`.
- Measured geometry of the 143 × 267 baseline (all distances are ink-top → ink-top):
  - heading ink-top → first link ink-top: **50px**
  - link rows repeat on a **34px pitch**
  - row 0 of the baseline is the first dark pixel of the heading; the last row is the descender of `Team collaboration`
- With `leading-none` 16px rows, a 34px pitch means an 18px gap between link rows. The heading's cap height starts ~3px below its line-box top — if the top of your diff shows a white band, trim that leading.

### Footer (layout)
- `<footer>` landmark, full-width, `neutral-0` background, **1px `neutral-300` top border**.
- Composes: Logo + Social Links (brand block) and three Link Columns — `Use cases` (the seven links above), `Explore` (`Design`, `Prototyping`, `Development features`, `Design systems`, `Collaboration features`, `Design process`, `FigJam`), `Resources` (`Blog`, `Best practices`, `Colors`, `Color wheel`, `Support`, `Developers`, `Resource library`).
- **Desktop (1200 × 468):** padding 32 top / 32 sides / 160 bottom. Four columns on a **278px horizontal pitch** — content ink starts at x = 32, 311, 589, 867 (the logo's stroke reaches x = 30; that's stroke overhang, the box is at 32). Brand block: logo at the top, Social Links row below it — logo ink top at y = 30, icon row ink top at y = 91.
- **Mobile (375 × 919):** padding 32 all sides except a similar 32 bottom. Top row: logo at the left, Social Links right-aligned (row ends flush at x = 343 = 375 − 32). Below, the three Link Columns stack vertically — section headings repeat on a **260px vertical pitch** (heading ink tops at y = 136, 396, 656); link rows tighten to a **30px pitch** at this breakpoint.

## Story setup (required for visual verification)

The visual verifier screenshots a **baseline-sized region anchored at the top-left of your story template's outermost element** (all six stories use element capture). If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges — fix sizing first, pixels second.

- Shrink-wrap stories (Link, Logo, Social Icon Link, Social Links, Link Column): give the story template an `inline-block`-style host so the element is exactly the component's size.
- Link Column story: wrap in a fixed-width container if needed — the baseline is 143px wide (the widest link's ink).
- Footer story: render at full width; the desktop viewport is exactly 1200px, mobile 375px.

Diff thresholds are relaxed for glyph anti-aliasing (calibrated from prior runs — Figma and Chromium rasterize glyphs differently even when geometry is perfect): icons/logo 0.10, ink-tight text 0.08, footer 0.06. Geometry — sizes, pitches, alignment — must still be exact.

## Accessibility

- Icon-only links: `aria-label` (e.g. `aria-label="X"`).
- Links are real `<a>` elements with `href`.
- The footer is a `<footer>` element; column headings are real headings.

