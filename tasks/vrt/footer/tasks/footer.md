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

## Component inventory

**The inventory is `tests/stories/expected.json`** — one story per component; selectors follow the naming convention (`atoms-link--default` → `app-link`). **Each story's required rendered size is exactly its baseline PNG's dimensions** in `tests/visual/<story-id>/` — the visual verifier screenshots a baseline-sized region.

## Design tokens (CSS variables)

Every visual value in this design maps to a token in `src/styles/tokens.css` (the Tailwind `@theme`). Use the Tailwind utilities the tokens generate — never raw hex, never arbitrary values.

**Required token bindings (color / background / border) are declared per story in `tests/validate/expected-tokens.json` — that file is the contract.** Read it before you build; `npm run validate:tokens` asserts that everything you render computes to exactly those tokens.

Type and spacing (verified visually, via the pixel diff):

| Design value | CSS variable | Tailwind utility |
|---|---|---|
| body & heading size 16px | `--text-base` | `text-base` (weight 400 links, 600 headings) |
| font | `--font-sans` (Inter) | default |
| icon gap 16px | `--spacing` × 4 | `gap-4` |
| footer padding 32px | `--spacing` × 8 | `p-8` / `pt-8` / `px-8` |
| desktop bottom padding 160px | `--spacing` × 40 | `pb-40` |

The spacing scale is a 4px grid (`--spacing: 0.25rem`) — all gaps and paddings in this design are multiples of it (e.g. an 18px row gap is `gap-4.5`, a 14px one `gap-3.5`).

## Visual spec

### Link (atom)
- A plain text link: `text-base` (16px) weight 400, `neutral-900`, no underline. Default story text: `UI design`.
- The baseline is **ink-tight** — the glyph ink fills the 69 × 16 box edge to edge (`leading-none` so the line box equals the font size).

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

