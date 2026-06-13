# HANDOFF — session 2026-06-06/07 (footer task, loop redesign)

One-off context-restore document. Read this top to bottom before doing anything;
it carries the state, the decisions, the findings, and Greg's standing rules
from a ~12h working session. Delete or archive once absorbed.

## 0. Greg's standing rules (also in auto-memory)

1. **NO auto-commits.** Edit, summarize, STOP — working tree stays dirty for his
   review; commit only when he says so.
2. **Shell scripts are frozen scope** (run_task.sh etc.) — new capability goes in
   typed packages (scoring → eval-runner). Two attempts to touch them were reverted.
3. **PLAN.md carries DATA, not HOW.** No Tailwind utility names, no "use
   leading-none", no negative-margin recipes, no "do not do X" coaching in plans.
   Measured numbers + parameterization + content only. Behavior fixes go into the
   recipe INSTRUCTIONS (AGENTS.md), once, generic — "fine tune the instructions,
   don't tell it what not to do (per task)".
4. Specs reference executable contracts; never duplicate what a JSON/verifier owns.
5. Update `.claude/commands/ui-spec.md` in the same commit as any pipeline change.

## 1. Working tree state (UNCOMMITTED — awaiting Greg's review)

Everything below is in the working tree, NOT committed (rule 0.1):

- `agents/vrt/AGENTS.md` — hard-rules collapsed to 2 (verifiers ARE the rules +
  read-only scaffold pointer at verify:integrity); anti-batching protocol-violation
  rule + "run the FIRST verify:element immediately after the FIRST component" in
  Phase 1.
- `init-states/angular-20-storybook/scripts/integrity-snapshot.mjs` (NEW) +
  `tests/integrity/integrity.spec.ts` (NEW) + package.json (`verify:integrity`
  script; postinstall now also runs the snapshot) + .gitignore (hashes.json) —
  the "don't touch the scaffold" rule made executable. Validated on the accordion
  run dir: tamper → named-file failure; revert → green.
- `init-states/angular-20-storybook/README.md` — verify:integrity row.
- `harness/framework.ts` + `harness/anthropic-sdk/src/index.ts` — `--debug` flag:
  PostToolUse hook on Bash matching `verify:element` injects a reflection nudge
  (additionalContext); model appends friction lines to `improvements.jsonl`
  ({element, phase, struggle, wanted}). Typechecks; NOT yet live-validated.
- `tasks/vrt/footer/PLAN.md` — strictly-one-at-a-time header; parameterization
  fixes (items 2/3/5: "ONE reusable component, parameterized by …, N instances");
  measured-data corrections (logo img at (30,30), ink edges 30/311/589/867,
  "measured ink positions are authoritative over nominal padding"); all HOW hints
  stripped per rule 0.3 (Greg also hand-edited).
- `.claude/commands/ui-spec.md` — §4b PLAN.md authoring (incl. parameterization
  rule); token-contract step; minimal-spec template; threshold table rewritten
  with measured rows.
- `IMPROVEMENTS.md` — backlog (see §5).

Suggest committing as themed commits AFTER Greg reviews: (a) integrity verifier,
(b) recipe hardening, (c) harness --debug, (d) PLAN/ui-spec updates.

## 2. Architecture decisions (all committed earlier, stable)

- **Three-layer division:** spec/.md + contract JSONs + snapshots = WHAT;
  `PLAN.md` (task ships it, operator-authored from measurements) = pre-chewed
  plan; `AGENTS.md` = HOW (procedure). Verification commands/conventions live in
  recipe + README, never in specs.
- **Executable-spec pattern:** generic verifier + per-task JSON config, spec
  references it. Instances: `expected.json` (inventory; structure roots at the
  HIGHEST level present: pages > layouts > molecules > atoms), `thresholds.json`
  (per-viewport override keys `"<story-id>/<viewport>"` > story > default),
  `expected-tokens.json` (per story: color/background/border → token; subset
  semantics; zero-occurrence fails; validate:tokens resolves vars live, exact
  computed match), `tests/integrity/hashes.json` (scaffold sha256, uncommitted).
- **THE LOOP (AGENTS.md):** Phase 0 read PLAN.md + contracts → notes.md TODO;
  Phase 1 mini-loops — per element: read specs → implement → ONE command →
  cross off → next. `npm run verify:element -- -g "<story-id>"` runs ALL suites
  filtered to one story (validated: 6 tests, ~2.3s warm). GATE = tests/stories|
  visual|structure paths; POLISH = tests/a11y|validate paths. **Done = gate
  green**; stubborn polish → debt list in notes.md; Phase 2 = `npm run verify`
  + debt paydown. Layered invariants: element captures are box-exact → passing
  atom's internals LOCKED; margins/gaps belong to the parent; reopen child only
  when parent proves it wrong.
- **Capture:** by convention pages-*→fullPage, else element (baseline-sized clip
  anchored at story template's outermost element; viewport auto-grows for clips
  taller than 800 — fixed after the v1 unwinnable-mobile bug). capture.json =
  rare override. Always-on current renders: `test-results/current/<story>/<vp>.png`
  every verify:visual run. HTML report has expected/actual slider for PASSED
  tests too (attached pair on pass).
- **Thresholds are ink-relative on sparse frames** (area-ratio goes blind:
  rearranged layout ≈ 0.75–1.5× ink fraction; perfect AA ≈ 0.4–0.5× ink).
  Footer: desktop 0.016 / mobile 0.025 (measured wrong-build 0.021/0.033);
  link-column 0.065 (wrong pitch measured 0.0739); exact-SVG glyphs 0.05
  (measured: icon 0.000!, logo 0.0095); ink-tight link 0.08 (2px offset = 0.25).

## 3. Run history + findings

- **footer v1** (4de47945…, $11.45, 150 turns, killed by turn cap mid-compaction
  -recovery): final true verdict **45/49** after fixing OUR bugs — mobile test was
  unwinnable (viewport clamp), thresholds were blind (footer passed both
  viewports at 0.06 with visibly wrong geometry — slider caught it; pitch 44 vs
  34, columns offset). Genuinely wrong: atoms-link (ink-tight 2px offset, 0.25),
  link-column pitch, footer both viewports. Burned turns being its own diff
  engine (17 pngjs scans, "baseline was 14px!" rabbit hole).
- **run 2** (95a9bef2…, ~$2, killed at ~46 turns by Greg): Phase 0 verbatim
  perfect (README→PLAN→contracts→dims). Then **batched 5 implementations with
  ZERO verifications** — post-mortem by running its own gates: logo PERFECT
  (6/6, built in 2 turns), social-icon-link PERFECT, social-links PERFECT,
  atoms-link visual fail 0.32 (same ink-tight trap), link-column = EMPTY DIR
  (mkdir then forgot), footer not started. notes.md claimed 0/6 while reality
  was 3/6 — **notes.md is self-report, not ground truth**; Greg killed a healthy
  run because of it. Root cause: Sonnet's write-all-then-test prior beat one
  line of prose → anti-batching rule added (uncommitted).
- Monitoring ground truth = `test-results/current/` renders + running
  `verify:element -- -g` ourselves in the run dir (safe when agent is dead;
  risky concurrently — port/build contention).

## 4. Next actions (where we stopped)

1. Greg reviews + commits the working tree (themed commits, §1).
2. **Relaunch:** `./run_task.sh vrt footer sonnet --debug` (uncommitted changes
   ride along — run_task rsyncs the working tree). First-run validation of the
   --debug hook: check injected context lands after first verify:element Bash
   call; improvements.jsonl appears only on real friction.
3. **Live monitoring** (his ask): after the agent's first build,
   `npx http-server runs/vrt/footer/<guid>/storybook-static -p 6010 -c-1` →
   http://localhost:6010 — read-only live Storybook view of what's built
   (refreshes per agent build; agent's MCP browser is origin-pinned to
   6006/6007 so no interference). Plus: tail agent.jsonl; notes.md = claimed
   state; test-results/current/ = real state; divergence = "it's not verifying".
4. Watch for: first verify:element right after first component (anti-batching
   landed?); plan-order adherence; the link element (ink-tight trap, 2 runs
   burned — if it fails again, the fix is an INSTRUCTION (recipe visual-facts
   already has leading-none + ink hints) or task-level threshold evidence,
   never a PLAN how-hint).

## 5. Backlog (IMPROVEMENTS.md — top items)

1. **Agent-native diff feedback** (the big one, designed, not built):
   diff-analysis module in vrt-summary-reporter — size delta sentence, shift
   detection via ink-profile correlation, region clusters (use looks-same),
   color triage, AA-share done-signal; labeled side-by-side composite PNG.
   Market scan done: nothing exists (closest: getzenai/playwright-coding-agent-
   reporter — no image analysis; looks-same has diffClusters).
2. Graceful turn-budget exhaustion (inject "write final report now" near cap).
3. Scoring-time integrity check (eval-runner; in-workspace one is deterrence).
4. measure:serve/measure:stop npm scripts (server-wrangling friction).
5. Typography in token contract ("font": "base" — would have killed the 14px
   hypothesis instantly).
6. Per-run port isolation (until then: never two runs concurrently).
7. Planning subagent to replace operator-authored PLAN.md (Greg's stated next
   step — PLAN.md is currently mandatory in Phase 0, fallback removed by Greg).

## 6. Quick paths

- Task: `tasks/vrt/footer/` (PLAN.md, tasks/footer.md, public/ SVGs, tests/)
- Recipe: `agents/vrt/AGENTS.md` · Workspace docs: init-state `README.md`
- Verifiers: init-state `tests/{stories,visual,a11y,validate,integrity}/`
- Runs: `runs/vrt/footer/` (4de47945=v1 post-mortem, 95a9bef2=run-2 workspace)
- Figma ops: `~/.claude/skills/figma-browser/` + `scripts/figma-browser.ts`
- Crop provenance: `scripts/crop-footer.ts` (+ crop-atoms.ts pattern)
