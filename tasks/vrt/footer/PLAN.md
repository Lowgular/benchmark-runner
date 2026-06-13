# PLAN — Footer

Your execution plan, pre-authored from the baseline measurements. Work the TODO top to bottom — **strictly one item at a time: an item is finished only when its `verify:element` gate is green and it's crossed off in `notes.md`; only then start the next.** Copy this list into `notes.md` and track status there.

All numbers below were measured from the baseline PNGs. Ink = dark pixels; ink coordinates are exact; box positions follow from them.

## TODO (execution order)

### 1. `atoms-logo--default` — `app-logo` — 27 × 39

- `<img src="/logo.svg" alt="…">` at its intrinsic 27 × 39. The SVG is stroke-drawn; no styling needed.

### 2. `atoms-social-icon-link--default` — `app-social-icon-link` — 24 × 24

- **ONE reusable component, parameterized by icon and accessible label** (e.g. inputs for the icon src + `aria-label`) — the Social Links molecule will render four instances of it. Do NOT create one component per icon.
- The four icons it will be given all ship in `public/icons/`: `x.svg`, `instagram.svg`, `youtube.svg`, `linkedin.svg` — used via `<img src="/icons/…">`, never redrawn.
- Behavior: an icon-only `<a>`, 24 × 24 box, icon at intrinsic size **centered** in the box. Three icons are 24 × 24 (fill the box); `youtube.svg` is 24 × 18 — centering handles it, no special case.
- Default story: the X icon (`/icons/x.svg`), `aria-label` "X".

### 3. `atoms-link--default` — `app-link` — 69 × 16 (ink-tight)

- **ONE reusable component, parameterized by its text** (and href) — the Link Columns will render 21 different links with it.
- Plain `<a>`: `text-base` (16px) weight 400, `neutral-900`, no underline.
- The crop is ink-tight: the glyph ink fills the 69 × 16 box edge to edge — row 0 is the cap top, the last row is the descender.
- Default story: text `UI design`.

### 4. `molecules-social-links--default` — `app-social-links` — 144 × 24

- Row of four `app-social-icon-link` instances, in order: X (`x.svg`), Instagram (`instagram.svg`), YouTube (`youtube.svg`), LinkedIn (`linkedin.svg`) — each with its name as the `aria-label`.
- 24px boxes + **16px gap** → 4×24 + 3×16 = exactly 144 wide.
- The icon set is fixed (always these four) — the component needs no inputs.

### 5. `molecules-link-column--default` — `app-link-column` — 143 × 267

- **ONE reusable component, parameterized by heading + list of links** — the Footer renders three instances with different content.
- Composes `app-link` for each list item; heading: `text-base` weight 600, `neutral-900`.
- Default story: heading `Use cases`; links `UI design`, `UX design`, `Wireframing`, `Diagramming`, `Brainstorming`, `Online whiteboard`, `Team collaboration`.
- Measured geometry (ink-top → ink-top):
  - link rows repeat on a **34px pitch**
  - heading ink-top → first link ink-top: **50px**
  - crop row 0 = the heading's first dark pixel (cap top); last crop row = the descender of `Team collaboration`

### 6. `layouts-footer--default` — `app-footer` — desktop 1200 × 468, mobile 375 × 919

Composes: brand block (Logo above Social Links) + three Link Columns — `Use cases` (links above), `Explore` (`Design`, `Prototyping`, `Development features`, `Design systems`, `Collaboration features`, `Design process`, `FigJam`), `Resources` (`Blog`, `Best practices`, `Colors`, `Color wheel`, `Support`, `Developers`, `Resource library`).

**Desktop (1200 × 468):**
- `<footer>`, `neutral-0` background, **1px `neutral-300` top border** (row 0 of the baseline)
- nominal padding: 32 top / 32 sides / **160 bottom**; measured ink positions below are authoritative where they disagree
- four columns on a **278px horizontal pitch** — measured ink left edges: logo 30, headings 311 / 589 / 867
- brand block: the logo `<img>` (27 × 39 = its ink box) sits at **(30, 30)**; social row ink top y = 91 (icons on a 40px pitch = 24 + 16 gap)
- column heading ink top y = 37; link rows as in the Link Column measurements

**Mobile (375 × 919):**
- top row: logo at the left (ink at 30, 30), Social Links **right-aligned** — the row ends flush at x = 343 (= 375 − 32 padding)
- below, the three Link Columns stack: section heading ink tops at y = **136, 396, 656** (260px section pitch)
- link rows tighten to a **30px pitch** at this breakpoint
- last ink row ends at y = 885 (~32px bottom padding)

## Reminders

- Token bindings per story are in `tests/validate/expected-tokens.json` (ink `neutral-900`, footer background `neutral-0`, top border `neutral-300`).
- The exact SVGs are in `public/` — use them, never redraw them.
- Element captures are box-exact: once an atom passes, its internals are locked; molecule/layout diffs are arrangement (gaps/margins) problems.
