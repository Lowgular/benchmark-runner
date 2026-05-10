# Angular 20 + Storybook 10 — Visual Benchmark init-state

Scaffold for the UI-only benchmark. Agents add a single Storybook story
under `src/lib/<component>/`; verifiers and validators score the result.

## Stack

- Angular 20.1, standalone components, Zone.js
- Storybook 10.3 (Angular builder, webpack5)
- Tailwind v4 with CSS-first `@theme` tokens (`src/styles/tokens.css`)
- Inter via `@fontsource/inter` (pinned for reproducible VRT)
- Playwright + `@axe-core/playwright`
- ESLint (typescript-eslint + angular-eslint), html-validate, stylelint

## Scripts

| Script           | What it does                                                  |
| ---------------- | ------------------------------------------------------------- |
| `npm start`      | Storybook dev on `:6006` (`ng run app:storybook`)             |
| `npm run build`  | Builds `storybook-static/` (`ng run app:build-storybook`)     |
| `npm run verify` | Build + serve + console capture + VRT (3 viewports). **Gate.** |
| `npm run validate` | axe + token-discipline + html-validate + stylelint + eslint. **Score.** |

Both write JSON to `.bench/`:

- `.bench/verify.json` — `{ build, serve, vrt }` pass/fail per layer
- `.bench/validate.json` — `{ axe, tokens, htmlValidate, stylelint, ngEslint, tamper }` counts/messages

## Inputs (env vars)

| Var                    | Used by   | Default            | Notes                                                    |
| ---------------------- | --------- | ------------------ | -------------------------------------------------------- |
| `BENCH_STORY_ID`       | both      | (required)         | Storybook story id, e.g. `components-button--default`    |
| `BENCH_BASELINES_DIR`  | verify    | (required for VRT) | Directory containing `mobile.png`, `tablet.png`, `desktop.png` |
| `BENCH_VRT_THRESHOLD`  | verify    | `0.02`             | Pixel-diff ratio above which a viewport fails            |
| `BENCH_AGENT_DIR`      | validate  | `src/lib`          | Where the agent's component lives                        |
| `BENCH_OUTPUT_DIR`     | both      | `.bench`           | Where JSON outputs are written                           |
| `BENCH_SKIP_BUILD`     | verify    | unset              | `1` to reuse existing `storybook-static/`                |
| `BENCH_SKIP_AXE`       | validate  | unset              | `1` to skip axe (no live story)                          |

## VRT viewports

- mobile: 375 × 812
- tablet: 768 × 1024
- desktop: 1280 × 800

DPR=1, animations killed, fonts awaited before screenshot.

## Conventions

- Agent writes to `src/lib/<component>/` only — anything outside is flagged by `tamper` in validate.json.
- Use Tailwind utilities backed by `tokens.css` — arbitrary values like `bg-[#...]` and inline `style=` are flagged by token-discipline.
- Strict tsconfig, strict eslint — `any`, `@ts-ignore`, non-OnPush, non-standalone all fail eslint.

