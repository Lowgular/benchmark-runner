# PLAN — Footer

Your execution plan, pre-authored from the baseline measurements. Work the TODO top to bottom — one element per mini-loop (see your workflow). Copy this list into `notes.md` and track status there.

All numbers below were measured from the baseline PNGs. Ink = dark pixels; ink coordinates are exact; box positions follow from them.

## TODO (execution order)

### 1. `atoms-logo--default` — `app-logo` — 27 × 39

- `<img src="/logo.svg" alt="…">` at its intrinsic 27 × 39. The SVG is stroke-drawn; no styling needed.

### 2. `atoms-social-icon-link--default` — `app-social-icon-link` — 24 × 24

- Icon-only `<a>` with an `aria-label`; default story renders `/icons/x.svg` (24 × 24, intrinsic).
- Note for later reuse: `/icons/youtube.svg` is 24 × 18 — it must sit vertically centered inside the same 24 × 24 box.

### 3. `atoms-link--default` — `app-link` — 69 × 16 (ink-tight)

- Plain `<a>`: text `UI design`, `text-base` (16px) weight 400, `neutral-900`, no underline.
- The crop is ink-tight: use `leading-none` so the 16px line box equals the font size; glyph ink fills the box edge to edge.

### 4. `molecules-social-links--default` — `app-social-links` — 144 × 24

- Row of four Social Icon Links, order: X, Instagram, YouTube, LinkedIn.
- 24px boxes + **16px gap** (`gap-4`) → 4×24 + 3×16 = exactly 144 wide.

### 5. `molecules-link-column--default` — `app-link-column` — 143 × 267

- Heading + 7 Links stacked. Default story: heading `Use cases`; links `UI design`, `UX design`, `Wireframing`, `Diagramming`, `Brainstorming`, `Online whiteboard`, `Team collaboration`.
- Heading: `text-base` weight 600, `neutral-900`.
- Measured geometry (ink-top → ink-top):
  - link rows repeat on a **34px pitch** → with `leading-none` 16px rows that is an **18px gap** (`gap-4.5`)
  - heading ink-top → first link ink-top: **50px**
  - crop row 0 = the heading's first dark pixel (cap height starts ~3px below a leading-none box top — if your diff shows a white band at the top, trim that leading)
  - last crop row = the descender of `Team collaboration` (37 + 267 − 1 from the footer's y-origin)

### 6. `layouts-footer--default` — `app-footer` — desktop 1200 × 468, mobile 375 × 919

Composes: brand block (Logo above Social Links) + three Link Columns — `Use cases` (links above), `Explore` (`Design`, `Prototyping`, `Development features`, `Design systems`, `Collaboration features`, `Design process`, `FigJam`), `Resources` (`Blog`, `Best practices`, `Colors`, `Color wheel`, `Support`, `Developers`, `Resource library`).

**Desktop (1200 × 468):**
- `<footer>`, `neutral-0` background, **1px `neutral-300` top border** (row 0 of the baseline)
- padding: 32 top / 32 sides / **160 bottom**
- four columns on a **278px horizontal pitch** — content boxes at x = 32, 310, 588, 866 (measured heading ink at 311/589/867; the logo's stroke overhangs to x = 30, its box is at 32)
- brand block: logo ink top y = 30; social row ink top y = 91 (icons on a 40px pitch = 24 + 16 gap)
- column heading ink top y = 37; link rows as in the Link Column measurements

**Mobile (375 × 919):**
- top row: logo at the left (ink at 30, 30), Social Links **right-aligned** — the row ends flush at x = 343 (= 375 − 32 padding)
- below, the three Link Columns stack: section heading ink tops at y = **136, 396, 656** (260px section pitch)
- link rows tighten to a **30px pitch** at this breakpoint → with `leading-none` 16px rows that is a **14px gap** (`gap-3.5`)
- last ink row ends at y = 885 (~32px bottom padding)

## Reminders

- Token bindings per story are in `tests/validate/expected-tokens.json` (ink `neutral-900`, footer background `neutral-0`, top border `neutral-300`).
- The exact SVGs are in `public/` — use them, never redraw them.
- Element captures are box-exact: once an atom passes, its internals are locked; molecule/layout diffs are arrangement (gaps/margins) problems.
