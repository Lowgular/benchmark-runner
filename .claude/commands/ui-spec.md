---
description: Create a VRT benchmark task from a Figma frame (or an existing baseline) — ground truth, spec, manifests, thresholds, launch. The operator-side Figma→task pipeline, kept current with every process change.
argument-hint: <task-name> [figma-url-or-node | crop-from:<existing-task>] [atom|molecule|layout|page]
---

# /ui-spec — Figma frame → VRT task

You are creating a new task under `tasks/vrt/<task-name>/` for the VRT benchmark. Follow this pipeline; it encodes everything learned from the atoms-up runs (button → tag → icon-button → image → price → select-field → accordion-item). **This file is a living document: whenever the pipeline changes during a session, update this command in the same commit.**

Arguments: `$ARGUMENTS` → task name, ground-truth source, atomic level.

## 1. Ground truth (provenance is law)

Every baseline PNG must be derived from committed inputs by committed code — never hand-cropped, never hand-transcribed.

**Mode A — fresh Figma export** (needs REST quota; token at `~/.figma_token`):
- Extend the manifest in `scripts/figma-export.ts` (nodeId, out path, expectWidth, label) or create a sibling script with the same pattern. The script strips Figma `tEXt/iTXt/zTXt` chunks (D-05: no Figma traces reach the agent) and verifies IHDR dimensions.
- Export page/composition frames at scale 1, per Platform variant (Desktop 1200 / Mobile 375).
- Quota intel: Starter REST quota exhausts fast and `retry-after` can be DAYS; MCP (`claude_ai_Figma`) has a separate monthly cap. Batch all discovery (node ids, bounds) into as few calls as possible; cache node JSON to /tmp.

**Mode B — crop from an existing committed baseline** (no Figma needed):
- Extend `scripts/crop-atoms.ts`. Detection menu, by component class:
  - solid-color block → `findRect(tokenColor, region, minRun=12)` — run-length filter kills text-AA pixels that hit token colors exactly
  - small circle/glyph in a clean region → `findRect(color, region, minRun=2)` (pole rows have short runs)
  - pure text (ink) → `findInkRect(region)` (luminance < 240 bbox; region must contain only the target's ink)
  - bordered card → `findInkRect` too — 1px borders anti-alias to ~#ececec bands on Figma's half-pixel grid; exact-color match FAILS, border is the outermost ink
  - overlays that don't belong to the atom (e.g. icon-button on image) → paint back to the fill color (+2px AA margin), documented in the script
- Run the script, print `x y WxH` per crop, and **view every crop PNG** (Read tool) before trusting it.

## 2. Task scaffold

```
tasks/vrt/<task-name>/
├── tasks/<task-name>.md                      # the spec (brief) — REQUIRED name match
└── tests/
    ├── stories/expected.json                 # ["<level>s-<name>--default", ...]
    └── visual/
        ├── thresholds.json                   # {"default":0.02,"overrides":{...}}
        └── <story-id>/
            ├── desktop.png                   # the crop/export
            └── capture.json                  # {"capture":"element"} for atoms/molecules; omit for pages (fullPage)
```

## 3. Thresholds (calibrated from run data — do not guess lower)

| Content class | maxDiffPixelRatio | Why |
|---|---|---|
| solid box, little text (button, tag) | 0.02 (default) | geometry is exact, text is small |
| icon glyph approximated (heart, image placeholder) | 0.08–0.10 | exact vectors unavailable until Figma quota allows extraction — note "tighten later" in spec |
| pure typography (price) | 0.06 | glyph AA between Figma and Chromium rasterizers |
| text-dense crop (select-field, accordion) | 0.08 | a geometrically PERFECT build diffs ~0.06 on glyph AA alone (measured) |

## 4. Spec template (the brief the agent sees)

Frontmatter `spec_version: 1`. Sections, in order:
1. **Title + one-liner** — "Build a single atom: …" / for compositions, the inventory framing.
2. **Component contract table** — Selector (`app-<name>`), Story id, "Rendered size in the default story: **exactly W × H px**" (W×H = crop dims, verbatim).
3. **Visual spec** — bullets; every color/radius/size as a TOKEN name (`neutral-800`, `radius-base`), never hex. Include line-height/padding arithmetic when text drives the height (e.g. "24px line + 2×4px padding → 32px").
4. **Story setup** — the capture contract, exact wording matters:
   - "The visual verifier screenshots a **W×H region anchored at the top-left of your story template's outermost element**."
   - fixed-width container hint for full-width components; `inline-block` host hint for shrink-wrap ones
   - "If your rendered size is off, the mismatch shows up as a diff band along the right/bottom edges — fix sizing first, pixels second."
   - For relaxed thresholds: state the number and that geometry must still be exact.
   - For ink-tight typography: warn "a solid band of diff at top or bottom means your line-height leading is leaking into the box" + `leading-none` hint.
5. **Accessibility** — per class: icon-only → aria-label; selects → label association (`input-missing-label` enforced); disclosures → `<button type="button">` + `aria-expanded`.
6. **Verification** — the three gate scripts + three validators, verbatim list.
7. Closer: atomic-design conventions line (standalone, OnPush, file layout per README).

## 5. Launch & diagnose

```bash
./run_task.sh vrt <task-name> sonnet   # background it; ~5–25 min
```

Run dirs: `runs/vrt/<task-name>/<guid>/`. Diagnose in this order:
1. `summary.json` → status, costUsd; `agent.jsonl` result line → turnCount
2. `test-results/SUMMARY.md` → per-verifier pass/fail + diff ratios
3. jsonl tool mix (one-liner: count tool_use by name) → friction signals:
   - many Bash greps into `storybook-static/` → spec ambiguity about the capture contract
   - repeated verify cycles with small Edits → missing measurement (browser skill should kick in)
   - `Skill: browser-measure` + high `browser_evaluate` / low screenshots → healthy measuring loop
4. **View the diff PNG before changing anything** — glyph-AA-only diff = threshold calibration issue (fix the task); geometry displacement = spec or agent issue.
5. Verifier failures that aren't the agent's fault (broken rule ids, locator semantics) → fix the init-state verifier, validate against the existing run dir (free — storybook already built there), THEN re-run.

Cost expectations (Sonnet, gen-2 stack): box atoms ~$0.4–1, glyph atoms ~$1, typography/molecules ~$1–5. A run dying with no `result` line in agent.jsonl = harness/infra problem, not agent failure — check the run_task log.

## 6. Iteration discipline

- One variable per re-run (spec wording OR threshold OR verifier OR recipe) — never two.
- Baselines and verifier semantics are frozen mid-run; calibrating a threshold from diff evidence BETWEEN runs is legitimate task authoring (document the evidence in the spec text).
- Record durable learnings in `tasks/vrt/SPEC-AUTHORING.md` (what worked / failed / do differently), and **update this command** when the pipeline itself changes.
