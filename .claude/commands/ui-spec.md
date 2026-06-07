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

**Mode C — browser export via real Chrome** (no REST quota needed; fully autonomous after one-time login):
- Operating manual: the user-level **`figma-browser` skill** (`~/.claude/skills/figma-browser/SKILL.md`) — read it before driving Figma's UI; it carries the hard rules, exact menu labels, and the `page.setDefaultTimeout(2500)` discipline (Playwright's 30s default turns every wrong locator into a 30s stall).
- Tool: `node scripts/figma-browser.ts` (NODE, not bun — Bun's ws can't complete the CDP handshake). Dedicated Chrome profile `~/.figma-chrome` on CDP port 9333; `ensure-chrome` launches it; Figma session persists in the profile.
- Find node ids WITHOUT canvas clicking: in-file search (`Cmd+F`, scope "All pages") via DOM, step results, read `node-id` from the URL. Or `inspect` mode: the user clicks, the URL mirrors the selection.
- `export <fileKey> <node:id> <out.png>` — selects via URL navigation, asserts the URL node-id matches, then **Copy as PNG** (`Cmd+Shift+C`) + CDP clipboard read. Copy-as-PNG is FIXED @2x regardless of zoom (verified); the tool box-filter halves to @1x and strips Figma text chunks.
- **Main component vs instance:** component definitions render slot PLACEHOLDERS (grey circles) and different dims — always export the INSTANCE from an example page, and eyeball the result before trusting it.
- **HARD RULE — zero blind position-clicks.** A position-click once hit a swap-instance control and *edited the file* (`Slot: Modified`); recovery = right-click selection → "Reset instance". Interact only with DOM-targeted elements (text/role locators) or URL navigation.

**Mode B — crop from an existing committed baseline** (no Figma needed):
- Extend `scripts/crop-atoms.ts`, or for a new source baseline create a sibling script with the same pattern (`scripts/crop-footer.ts` crops from the footer export). Detection menu, by component class:
  - solid-color block → `findRect(tokenColor, region, minRun=12)` — run-length filter kills text-AA pixels that hit token colors exactly
  - small circle/glyph in a clean region → `findRect(color, region, minRun=2)` (pole rows have short runs)
  - pure text (ink) → `findInkRect(region)` (luminance < 240 bbox; region must contain only the target's ink)
  - bordered card → `findInkRect` too — 1px borders anti-alias to ~#ececec bands on Figma's half-pixel grid; exact-color match FAILS, border is the outermost ink
  - overlays that don't belong to the atom (e.g. icon-button on image) → paint back to the fill color (+2px AA margin), documented in the script
- Run the script, print `x y WxH` per crop, and **view every crop PNG** (Read tool) before trusting it.

## 1b. Vector assets (icons, logos)

When the frame contains icon/logo glyphs, ship the **exact vectors** with the task instead of letting the agent approximate them:
- Get them via Mode C: select the node (URL only), Main menu → Edit → **Copy as** → Copy as SVG (`navigator.clipboard.readText()`), split sub-icons by `id`.
- Place them under `tasks/vrt/<task>/public/` (e.g. `public/logo.svg`, `public/icons/x.svg`) — the overlay drops them into Angular's static-assets dir, so the agent uses `/icons/x.svg` directly.
- List each asset in the spec with its intrinsic size and any quirk (e.g. a 24×18 glyph that sits in a 24×24 box).
- Exact vectors mean glyph stories no longer need the 0.08–0.10 "approximated glyph" relaxation for geometry — only for AA (see §3).
- Cross-check asset dims against the baseline crops (the icon SVG viewBox should equal the crop dims) — corroboration is free verification.

## 1c. Token contract (CSS variables) — `expected-tokens.json`

The agent may only use Tailwind utilities generated from `src/styles/tokens.css` (`@theme` CSS variables; `validate:tailwind` bans arbitrary values), and the spec's token claims are **machine-checked** by `validate:tokens`. This conversion is the operator's job — the design tool is an implementation detail of THIS command; the task ships only neutral artifacts (a Sketch source would produce the identical JSON).

1. **Sample every distinct color from the baseline** (throwaway pngjs script: ink, borders, fills) and map each hex to its `--color-*` variable in `init-states/angular-20-storybook/src/styles/tokens.css`. Exact match required — these tokens were extracted from the same design system. When sampling is ambiguous (two tokens share a value, overlapped fills), read the node in Figma Dev Mode via the `figma-browser` skill — it exposes per-node CSS and variable names.
2. **Check sizes against the scales**: type sizes → `--text-*`; gaps/paddings must land on the 4px `--spacing` grid (Tailwind v4 generates fractional steps too — 18px = `gap-4.5`); radii → `--radius-*`.
3. **A value with no token = a task-overlay change**: extend `tokens.css` via the task's `src/styles/` overlay (same generated-file discipline — extraction script, not hand-edits), never by editing the init-state mid-task.
4. **Author `tests/validate/expected-tokens.json`** — per story id, a flat map of general css property → token name, keyed the way the design tool describes the node (WHAT, not HOW):
   ```json
   {
     "atoms-link--default": { "color": "neutral-900" },
     "layouts-footer--default": { "color": "neutral-900", "background": "neutral-0", "border": "neutral-300" }
   }
   ```
   Supported properties: `color` (every text-bearing element), `background` (every non-transparent fill), `border` (every visible border side) — subset semantics; a value may be an array when a story legitimately uses several tokens for one property. Declare all applicable properties for EVERY story (undeclared = unchecked); omit image-only stories. A declared property with zero rendered occurrences FAILS — claims must be real.
5. **Reference, don't duplicate** — the spec's "Design tokens" section is a short block stating: bindings are required, the values live in `tests/validate/expected-tokens.json` (the contract — the agent reads it directly), and `validate:tokens` enforces them. NO token table in the markdown — one source of truth. Scales the JSON can't express yet (type, spacing) stay as a hand-written table, marked "verified visually" (see `tasks/vrt/footer/tasks/footer.md`).

## 2. Task scaffold

```
tasks/vrt/<task-name>/
├── tasks/<task-name>.md                      # the spec (brief) — REQUIRED name match
├── public/                                   # optional exact vector assets (overlaid into Angular's public/)
└── tests/
    ├── stories/expected.json                 # ["<level>s-<name>--default", ...]
    ├── validate/expected-tokens.json         # token contract per story (see 1c)
    └── visual/
        ├── thresholds.json                   # {"default":0.02,"overrides":{...}}
        └── <story-id>/
            ├── desktop.png                   # the crop/export
            └── mobile.png                    # only for stories verified at the mobile breakpoint
```

Capture mode is **by convention** — `pages-*` → fullPage, everything else → element capture (baseline-sized clip anchored at the story root). No per-story file needed; a `capture.json` (`{"capture":"page"|"element"}`) in the story dir exists only as a rare override.

**Multi-component tasks** (a layout/page plus its pieces): list EVERY piece's story in `expected.json` and baseline every piece — all crops derive from the one committed composition export, so the marginal cost is one crop-script entry each. The structure verifier roots at the **highest atomic level present** in `expected.json` (pages > layouts > molecules > atoms) and asserts every lower-level selector appears in the root story's DOM — this is what makes "atomic design is scored" true for layout-rooted tasks like the footer.

## 3. Thresholds (calibrated from run data — do not guess lower)

| Content class | maxDiffPixelRatio | Why |
|---|---|---|
| solid box, little text (button, tag) | 0.02 (default) | geometry is exact, text is small |
| icon glyph approximated (heart, image placeholder) | 0.08–0.10 | exact vectors unavailable until Figma quota allows extraction — note "tighten later" in spec |
| icon glyph from exact SVG, tiny crop (24×24) | 0.05 | measured (footer v1): exact-SVG icon rendered PIXEL-IDENTICAL (0.000), logo 0.0095, icon row 0.02 — exact vectors barely diff at all; 0.10 was over-generous |
| pure typography (price) | 0.06 | glyph AA between Figma and Chromium rasterizers |
| ink-tight text crop (link) | 0.08 | same AA class, higher ink fraction in a tight crop (a 2px ink offset measures 0.25 — separation is wide) |
| text-dense crop (select-field, accordion) | 0.08 | a geometrically PERFECT build diffs ~0.06 on glyph AA alone (measured) |
| sparse text column (link-column) | 0.065 | measured (footer v1): wrong 44px-vs-34px pitch landed at 0.0739 — under the old 0.08. Window between perfect-AA (~0.05–0.06) and rearranged (0.074) is tight; if a perfect build trips it, the diff PNG proves pure AA speckle → recalibrate up with evidence |
| sparse composition (footer layout) | **≈ 0.6× ink fraction, per viewport** (footer: desktop 0.016, mobile 0.025) | **area-ratio thresholds go blind on mostly-white frames** — a rearranged layout's pixelmatch ratio lands only ~0.75× the ink fraction (its AA heuristic discounts shifted thin glyphs), while a perfect build diffs ~0.4× ink. Measure each baseline's ink fraction (pngjs: % of px with channel < 240) and set per-viewport keys (`"<story-id>/<viewport>"` in thresholds.json) — ink density differs across breakpoints, one number rarely separates both. Incident: footer v1 passed BOTH viewports at 0.06 with visibly wrong geometry (pixelmatch 0.021/0.033 vs ink 0.028/0.044). |

## 4. Spec template (the brief the agent sees)

**The snapshots ARE the spec.** The markdown is one goal sentence plus pointers to the executable contracts — see `tasks/vrt/footer/tasks/footer.md` for the canonical shape. Frontmatter `spec_version: 1`, then:

1. **Goal sentence** — "Implement the <thing> exactly as shown in the snapshots, as an atomic composition."
2. **Contract pointers** — one bullet each: `tests/stories/expected.json` (inventory + structure note), `tests/visual/<story-id>/` (snapshots = pixel contract at exact dimensions), `tests/validate/expected-tokens.json` (token bindings), and `public/` (exact vector assets — "use them, never redraw") when the task ships any.
3. **Snapshot map** — a small table: story id → what the snapshot shows, one line each, naming the default-story content so it's unambiguous ("one text link (`UI design`)").

Nothing else. No design-value tables, no Tailwind utility names (HOW), no measured-geometry narrative, no capture mechanics, no a11y sections — everything is either visible in the snapshots, owned by AGENTS.md, enforced by a validator, or an implementation choice that belongs to the agent. If a run proves the loop can't converge from snapshots alone, add **measured ink geometry** (pitches, offsets — pngjs scans of the baseline) to the spec BETWEEN runs as calibrated guidance, documenting the diff evidence (§6).

**Do NOT repeat in the spec** what's owned elsewhere — duplicated text drifts:
- verification commands, workflow, atomic-design conventions → `agents/vrt/AGENTS.md`
- the visual capture contract (element clips, diff-band semantics, `inline-block` hosts, leading-none warnings, thresholds-absorb-AA-only) → AGENTS.md "Visual capture contract"
- threshold values → `tests/visual/thresholds.json`
- token bindings → `tests/validate/expected-tokens.json`
- accessibility rules already enforced by `validate:a11y`/`validate:semantic` (axe `link-name`, `image-alt`, label association, heading rules)

## 4b. PLAN.md — the pre-authored execution plan (hand-hold mode)

Ship a `PLAN.md` at the task root (overlays to the workspace root) — the agent recipe's Phase 0 tells the model to execute it exactly instead of deriving its own plan. Author it from the SAME measurements used for crops and thresholds (you already have every number):

- **TODO in execution order**: all atoms → all molecules → layouts → page; one numbered section per element with story id, selector, exact dims.
- Per element: assets to use, content strings, and the **measured ink geometry** (pitches, offsets, padding) plus the construction arithmetic where it's solid (e.g. "34px pitch → leading-none 16px rows + 18px gap = `gap-4.5`").
- Per-breakpoint sections for responsive layouts (positions, alignment, pitch differences).
- Close with reminders that point at (not repeat) the contracts: tokens manifest, `public/` assets, the layered-invariants rule.

The spec markdown (`tasks/<task>.md`) replaces any work-order section with a one-line pointer: "Your execution plan ships with the task: `PLAN.md` — follow it exactly." Division of labor: **spec = WHAT (contracts), PLAN.md = pre-chewed plan (operator-derived numbers + order), recipe = HOW (the mini-loop procedure)**.

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
