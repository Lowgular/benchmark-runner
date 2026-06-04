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

| Script           | What it does                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| `npm start`      | Storybook dev on `:6006` (`ng run app:storybook`)                                     |
| `npm run build`  | Builds `storybook-static/` (`ng run app:build-storybook`)                             |
| `npm run verify:visual` | `npm run build && playwright test` — VRT sweep over 3 viewports. Writes test-results/. |

## Running end-to-end

The task runner expects to be invoked from a fresh per-run folder so concurrent
runs don't trample each other. Convention: `runs/<bench>/<task>/<guid>/`.

```bash
cd benchmark-runner
mkdir -p runs/vrt/pricing/$(uuidgen) && cd runs/vrt/pricing/<that-guid>

bun run /abs/path/to/task-runners/anthropic-sdk/src/main.ts \
  /abs/path/to/tasks/vrt/pricing \
  /abs/path/to/init-states/angular-20-storybook \
  /abs/path/to/agents/vrt/AGENTS.md \
  opus --verbose
```

The runner rsyncs the init-state into cwd (skipping `node_modules`, `.angular`,
`storybook-static`, `test-results`), runs `npm install`, then overlays the task
directory on top. Once it finishes, you have a fully wired workspace where
`npm run verify:visual` works.

## VRT iteration loop

Stories are auto-discovered: each subfolder under `tests/visual/` is treated
as a Storybook story id, and the folder holds three baseline PNGs:

```
tests/visual/
├── storybook.spec.ts
└── <story-id>/             e.g. app-pricing--default/
    ├── mobile.png
    ├── tablet.png
    └── desktop.png
```

No env vars to set — the spec walks `tests/visual/` and runs every viewport
for every discovered story. The per-task overlay just drops these folders in.
After every run, output lands in `test-results/`:

| File                                                | Read it when…                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test-results/SUMMARY.md`                           | **Start here.** One section per failing viewport with pixel-diff ratio + paths to the artifacts.    |
| `test-results/<test-folder>/<name>-expected.png`    | You want to see the target — what the story should look like.                                       |
| `test-results/<test-folder>/<name>-actual.png`      | You want to see what your story currently renders.                                                  |
| `test-results/<test-folder>/<name>-diff.png`        | You want to see which regions actually differ (red highlight).                                      |
| `test-results/html/index.html`                      | Interactive HTML report — useful for humans, not agent-readable.                                    |

The loop:

1. `npm run verify:visual` (build + Playwright).
2. Read `test-results/SUMMARY.md` → pick the worst-diff viewport.
3. View its `expected.png` / `actual.png` / `diff.png` to see what's off.
4. Edit the component / story / tokens.
5. Repeat until SUMMARY.md reports all passed.

## Folder Structure

```
.
├── src/
│   ├── app/             Classic Angular 20 app — standalone components, OnPush.
│   │                    Agents add new components here (one folder per component:
│   │                    `<name>.ts`, `<name>.html`, `<name>.stories.ts`).
│   ├── styles/
│   │   ├── tokens.css   Tailwind v4 `@theme` design tokens — the source of truth
│   │   │                for color, typography, spacing, radius. Components must
│   │   │                consume these (no hardcoded hex, no arbitrary values).
│   │   └── global.css   Global styles + Tailwind entrypoint.
│   ├── index.html       App shell (Storybook has its own preview shell).
│   └── main.ts          Angular bootstrap (only used by `ng serve`, not Storybook).
│
├── .storybook/          Storybook 10 config (`main.ts`, `preview.ts`).
│                        Stories are auto-discovered from `src/**/*.stories.ts`.
│
├── tasks/               Task briefs — one Markdown file per benchmark task.
│                        Each file is the spec the agent reads: goal, visual
│                        requirements, references to baseline images. The task
│                        runner overlays per-task assets (e.g. reference PNGs)
│                        on top of this directory before the agent starts.
│
├── tests/
│   └── visual/          Playwright VRT spec + baselines. The spec discovers
│                        every subfolder of `tests/visual/` as a Storybook story id
│                        and sweeps 3 viewports (mobile 375, tablet 768, desktop 1280)
│                        against `tests/visual/<story-id>/{mobile,tablet,desktop}.png`.
│
├── test-results/        Playwright output: per-test failure artifacts
│                        (`*-actual.png`, `*-expected.png`, `*-diff.png`),
│                        `SUMMARY.md` (agent-readable diff report — see
│                        "VRT iteration loop" above), and `html/` (HTML report).
│
├── angular.json         Angular CLI config (build + Storybook builder targets).
├── playwright.config.ts VRT config (viewports, diff budget, reporters).
├── vrt-summary-reporter.ts  Custom Playwright reporter that writes test-results/SUMMARY.md.
├── package.json         Scripts table is above; pinned deps for reproducibility.
└── tsconfig*.json       TS configs for app, tests, Storybook.
```

### Where new work lives

| You are…                | Put it in…                                      |
| ----------------------- | ----------------------------------------------- |
| Adding a component      | `src/app/<name>/` (`.ts` + `.html` + `.stories.ts`) |
| Adding a design token   | `src/styles/tokens.css` (extend `@theme`)       |
| Adding a benchmark task | `tasks/<slug>.md` (+ assets the runner overlays) |
| Updating a baseline     | `tests/visual/<story-id>/{mobile,tablet,desktop}.png` (or rerun with `--update-snapshots`) |

