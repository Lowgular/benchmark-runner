# Angular 20 + Storybook 10 — component workspace

You build a small atomic-design component library here; verifiers and
validators score the result against the task's snapshots and contracts.

## Stack

- Angular 20.1, standalone components, `ChangeDetectionStrategy.OnPush`, `signal()` state, `@if`/`@for` control flow
- Storybook 10.3 (Angular builder)
- Tailwind v4 with CSS-first `@theme` tokens (`src/styles/tokens.css`) — the only styling values allowed
- Inter via `@fontsource/inter` (pinned for reproducible VRT)
- Playwright + `@axe-core/playwright` + html-validate

## File layout

Components live under `src/app/<level>/<name>/`, one folder per component:

```
src/app/
├── atoms/<name>/         e.g. atoms/link/
│   ├── <name>.component.ts        (standalone, OnPush, selector app-<name>)
│   ├── <name>.component.html
│   └── <name>.stories.ts          (title "Atoms/<Name>", one Default export)
├── molecules/<name>/
├── layouts/<name>/
└── pages/<name>/
```

Story id = `kebab-case(title with "/"→"-") + "--" + kebab-case(export)`:
`"Atoms/Link"` + export `Default` → `atoms-link--default`. Component
selector = `app-` + the story base name minus its level prefix
(`atoms-link--default` → `app-link`). Static assets shipped by the task
(if any) live in `public/` and are served from the web root (`/icons/x.svg`).

The Storybook preview is preconfigured with `layout: "fullscreen"` — no
per-story layout parameter needed.

## Visual capture

`verify:visual` screenshots each baselined story per viewport (mobile 375 /
desktop 1200 — only viewports whose PNG exists are checked):

- `pages-*` stories → full-page screenshot at the viewport width
- atoms / molecules / layouts → a **clip exactly the baseline PNG's size,
  anchored at the top-left of the story template's outermost element**
  (a `capture.json` in the story dir can override the mode)

The screenshot is then pixel-diffed against the baseline under the story's
threshold from `tests/visual/thresholds.json` (per-viewport override key
`"<story-id>/<viewport>"` > per-story key > default).

## Task contracts (read-only)

| File | Contract |
| --- | --- |
| `tests/stories/expected.json` | required story ids — the component inventory |
| `tests/visual/<story-id>/*.png` | snapshots; their pixel dimensions = the required rendered size; only the viewports whose PNG exists are checked |
| `tests/visual/thresholds.json` | per-story pixel-diff thresholds |
| `tests/validate/expected-tokens.json` | required design-token bindings (color / background / border per story) |

## Scripts

| Script | What it checks |
| --- | --- |
| `npm start` | Storybook dev server on `:6006` |
| `npm run build` | builds `storybook-static/` (verifiers rebuild automatically when stale) |
| `npm run verify:stories` | every expected story id registers and renders |
| `npm run verify:visual` | screenshot diff vs the snapshots (mobile 375 / desktop 1200) |
| `npm run verify:structure` | the highest-level story composes all lower-level component selectors |
| `npm run validate:a11y` | axe-core WCAG scan per story |
| `npm run validate:semantic` | semantic HTML / heading / label rules |
| `npm run validate:tailwind` | bans arbitrary Tailwind values, inline styles, oversized markup |
| `npm run validate:tokens` | computed styles bind to the declared design tokens |
| `npm run verify:integrity` | no read-only scaffold file drifted from its setup-time sha256 snapshot |
| `npm run verify:element -- -g "<story-id>"` | every check above, filtered to ONE story — the per-element loop command |
| `npm run verify` | all of the above with a single build |

## Reading results

| File | Read it when… |
| --- | --- |
| `test-results/SUMMARY.md` | **Start here.** Per-test pass/fail; failing visuals include the pixel-diff ratio + artifact paths. |
| `test-results/<script>.json` | the JSON envelope for exactly the script you just ran |
| `test-results/current/<story-id>/<viewport>.png` | what every story renders right now — written on EVERY `verify:visual` run, pass or fail |
| `test-results/<folder>/<name>-diff.png` | which regions differ (red highlight; failures only) |
| `tests/visual/<story-id>/<viewport>.png` | the target |

The loop: run a verify script → read `SUMMARY.md` → view the diff artifacts →
edit the component → repeat until green.
