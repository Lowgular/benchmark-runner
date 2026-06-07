# Improvements backlog

Captured 2026-06-06 during the footer v1 run (snapshot-only spec experiment).
The v1/v2 A/B was abandoned (v1 ran against broken gates); cheap
evidence-backed items landed 2026-06-07, the rest live here.

## 1. Agent-native visual diff feedback (the big one)

**Problem (evidence: footer v1 run, `runs/vrt/footer/4de47945…`):** the agent
runs `verify:visual`, then burns turns being its own diff engine — pngjs scans
of baselines, browser measurements, wrong hypotheses ("baseline was generated
with 14px links!"). Stock Playwright feedback is `ratio 0.06` + three
full-size PNGs (expected/actual/diff). The diff image says WHERE, never WHAT
or BY HOW MUCH; everything quantitative that pixelmatch computed is discarded.
Vision is the agent's weakest precise modality; text is native and exact.

**Principle:** the verifier holds both images and all the truth — make it
speak. Feed precision through text; reserve images for what's genuinely
visual.

**Design — analysis module + reporter integration:**

```
tests/visual/diff-analysis.ts        (new, pure pngjs + looks-same)
  analyze(expected, actual) → { sizeDelta, shift, clusters[+colors], aaShare }
  renderMarkdown(analysis)  → sentences for SUMMARY.md

vrt-summary-reporter.ts              (existing agent-native reporter)
  on visual failure: append the analysis block
  + write ONE labeled side-by-side composite PNG (expected | actual | diff)
```

Target SUMMARY.md block:

```
### molecules-link-column--default · desktop — FAIL (ratio 0.113, threshold 0.08)
- size: you render 143×297, expected 143×267 → 30px too tall
- alignment: rows 0–52 match; everything below is shifted +30px down
- diff regions: 92% of diff inside [0..143]×[53..297]
- color: ink matches (#1e1e1e both) — geometry problem, not color
- anti-aliasing: 3% of diff is glyph-edge AA (ignorable)
```

Analyzers (all deterministic, testable offline against v1's failure artifacts):
- **size delta** — PNG dims compared, one sentence
- **shift detection** — row/column ink-profile correlation: "below y=52
  everything is +30px down". Hand-rolled (~50 lines); kills the
  leading-leak / gap-guessing rabbit holes. (x-img-diff does this with
  OpenCV/WASM — overkill for rigid UI offsets.)
- **region clustering** — use `looks-same` (`shouldCluster: true` →
  `diffClusters` bboxes). Mature, pure JS, zero native deps.
- **color triage** — dominant (expected,actual) pixel pair per cluster:
  "expected #1e1e1e, found #000000" → geometry-vs-color in one glance
- **AA classifier (done-signal)** — % of diff pixels 1px-adjacent to matching
  ink in both images: "97% AA → you are geometrically perfect; stop"

Tier 2 (after Tier 1 proves out):
- auto-zoomed crops of worst regions at 2–4×, expected-vs-actual paired
- pixel-ruler ticks on the composite edges
- DOM-aware feedback: dump rendered `app-*` component boundingBoxes for the
  failing story next to the shift line — the culprit element names itself

**Market scan (2026-06-06):** nobody has built the visual half.
- [playwright-coding-agent-reporter](https://github.com/getzenai/playwright-coding-agent-reporter) — validates the agent-native-reporter pattern (consolidated markdown for Claude Code etc.); zero image analysis
- [looks-same](https://github.com/gemini-testing/looks-same) — diffBounds/diffClusters + perceptual tolerance + AA awareness; the one dependency worth adopting
- [x-img-diff-js](https://github.com/reg-viz/x-img-diff-js) — translated-region detection via OpenCV/WASM; right idea, too heavy
- [auto-image-diff](https://github.com/AdamManuel-dev/auto-image-diff) — "for AI coding agents", classifies content/style/layout/size/structural; requires system ImageMagick (no) — steal the taxonomy, not the impl
- [odiff](https://github.com/dmtrKovalenko/odiff) — speed only, irrelevant at our sizes

## 2. Recipe (AGENTS.md) fixes — evidence-grounded

~~All landed 2026-06-07~~ (de-paging, read-all-contracts step 1, glyph-metrics
+ measure-first bullets in the capture contract, single-story `-g` filter
hint, notes.md MAY→MAINTAIN, step-4 "one component at a time; verify before
the next"). The v1/v2 A/B was abandoned — v1 ran against broken gates, so v2
was merged back into `tasks/vrt/footer` (guided brief + calibrated
thresholds) as the single canonical footer task.

## 3. Harness

- **Graceful budget exhaustion** — at the turn limit the run just dies:
  v1's RESPONSE.md is a mid-sentence fragment, no inventory, no
  self-assessment. The anthropic-sdk harness can use streaming input to
  inject "≈10 turns left — write your final report now" near the cap so
  every run ends with a report, even losing ones. Leaderboard hygiene.
- **Automated Pass-2 scoring** — still manual: `cd <run-dir> && npm run
  verify` (the init-state owns the suite; test-results/ is the score
  record). NOT in shell scripts (run_task.sh is frozen scope — two
  attempts reverted 2026-06-07); when automated, it belongs in the
  existing eval-runner package, which the two-pass design already names
  as the "separate eval step" that amplifies summary.json with
  results[0].score.

## 4. Workspace ergonomics

- **`npm run measure:serve` / `measure:stop`** — v1 logged 5× `kill` + `lsof`
  wrangling servers; the PID-file discipline in the browser-measure skill
  prose isn't fully sticking. Make the lifecycle a tool, not an instruction.

## 5. Contract growth

- **Typography in the token contract** — `expected-tokens.json` covers
  color/background/border, but v1's actual defect class was type geometry
  (pitch, leading, size guesses). A `"font": "base"` property (computed
  font-size == `--text-base` on text-bearing elements) follows the same
  WHAT-pattern and would have instantly falsified v1's "baseline is 14px"
  hypothesis.

## 6. Operational

- **Per-run port isolation** (parked) — two concurrent runs both bind
  6006/6007; a cross-bound verifier could screenshot the other run's build.
  Until fixed: never run two tasks concurrently.
- **Schema-validate the contract JSONs** (JSON Schema per kind) — typo'd token
  names / properties should fail at authoring time. Becomes important once
  task authoring is opened up beyond /ui-spec.
- **Threshold tightening** — with diff analysis + AA classifier in place,
  revisit the relaxed glyph thresholds (0.08–0.10): the AA-share metric may
  allow strict thresholds with an explicit AA allowance instead.
  **Incident (footer v1):** area-ratio thresholds are blind on sparse frames —
  the footer passed BOTH viewports at 0.06 with visibly wrong geometry
  (slider exposed it; crude diff 0.043/0.068 vs ink fraction 0.028/0.044).
  Interim rule now in /ui-spec: sparse-frame threshold ≈ 1.0× the baseline's
  ink fraction (perfect ≈ 0.5× ink, rearranged ≈ 1.5× ink). The real fix is
  the AA classifier: threshold on NON-AA diff share instead of total ratio.
