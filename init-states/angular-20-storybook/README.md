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
| `npm run verify` | all of the above with a single build |

## Reading results

| File | Read it when… |
| --- | --- |
| `test-results/SUMMARY.md` | **Start here.** Per-test pass/fail; failing visuals include the pixel-diff ratio + artifact paths. |
| `test-results/<script>.json` | the JSON envelope for exactly the script you just ran |
| `test-results/<folder>/<name>-actual.png` | what your story currently renders |
| `test-results/<folder>/<name>-diff.png` | which regions differ (red highlight) |
| `tests/visual/<story-id>/<viewport>.png` | the target |

The loop: run a verify script → read `SUMMARY.md` → view the diff artifacts →
edit the component → repeat until green.
