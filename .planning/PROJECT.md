# VRT Benchmark — Angular UI Craft Benchmark

## What This Is

A benchmark that demonstrates modern LLM agents (starting with Sonnet/Opus via the Anthropic SDK) can build pixel-perfect, accessible, well-structured Angular UIs from a written spec — the kind of UI work normally handed off from Figma. The product is the benchmark itself: task specs, an in-loop verifier suite, a reliable agent harness, and eventually a multi-model/multi-harness leaderboard.

## Core Value

A task spec + verifier feedback loop good enough that even weaker models (Haiku) can produce pixel-perfect, accessible, atomically-structured Angular UI — proving the spec/loop, not the model, is the bottleneck.

## Requirements

### Validated

<!-- Inferred from existing codebase (brownfield). -->

- ✓ Multi-harness agent framework: `framework.ts` dynamically imports harness plugins (anthropic-sdk, ai-sdk/OpenRouter, deepagents), streams Message events, writes `agent.jsonl` / `RESPONSE.md` / `summary.json` — existing
- ✓ Run orchestration: `run_task.sh` does env preflight, GUID run dirs, rsyncs init-state, overlays task files, invokes framework — existing
- ✓ Angular 20 + Storybook 10 init-state with Playwright VRT scaffold (3 viewports: desktop/tablet/mobile) — existing
- ✓ Agent recipe format: `agents/vrt/AGENTS.md` (YAML frontmatter + system prompt body) — existing
- ✓ Pass-1 summary in WCS shape (`summary.json`, score=null until Pass-2 eval) — existing
- ✓ Draft newsletter-form task with reference baselines — existing, treated as inspiration only; may be changed at will

### Active

**Stage 1 — verifier layer + spec discovery on one task:**

- [ ] In-loop verifier CLI in the init-state (`npm run verify`-style) returning structured, actionable results the agent can act on
- [ ] Verifier dimension: VRT pixel diff vs reference baselines at 3 viewports
- [ ] Verifier dimension: accessibility scan (axe-core) on rendered stories with violation selectors
- [ ] Verifier dimension: semantic HTML checks (proper elements, heading structure, landmarks — no div-soup)
- [ ] Verifier dimension: atomic design structure check (component decomposition matches spec's mandated atoms/molecules/organisms)
- [ ] Newsletter-form task spec: full requirements spec acting as the "Figma replacement" (format to be discovered empirically — see Key Decisions)
- [ ] Reference implementation + baseline screenshots for newsletter-form (ground truth for VRT)
- [ ] Reliable agent loop: prompts/recipe enforce spec-read → build → verify → iterate-until-green
- [ ] Spec/loop iteration: run Sonnet → Opus → Haiku against the task, refine spec + prompts + verifier feedback until even Haiku performs well

**Stage 1.5 — generalize:**

- [ ] Additional tasks of increasing visual complexity using the proven spec format

**Stage 2 — evals + leaderboard:**

- [ ] Scoring scheme designed from observed first results (deferred by design — see Key Decisions)
- [ ] Scalable eval layer (Pass-2) filling `summary.json` scores
- [ ] Benchmark leaderboard across models × harnesses

### Out of Scope

- App logic / functionality / e2e behavior tests — the benchmark measures UI craft, not whether the app "works"
- Angular wiring beyond the bare minimum — signals/forms plumbing only as needed to render the UI
- Figma integration (API/MCP/browser) — a separate future agent will dump Figma designs into spec format; this benchmark must work from a self-contained written spec
- Pre-committing to a specific agent loop, prompt set, or model list — these are the variables being benchmarked, not fixed inputs
- Upfront scoring/leaderboard design — deliberately deferred until first real model results exist

## Context

- **Existing infrastructure is inspiration, not contract.** Everything in the repo (harnesses, init-state, draft newsletter-form task) can be changed at will to serve the end goal.
- **Repo layout:** `harness/` (framework + 3 plugins), `init-states/angular-20-storybook/`, `tasks/vrt/newsletter-form/` (draft), `agents/vrt/AGENTS.md`, `eval-runner/`, `run_task.sh`. Codebase map at `.planning/codebase/`.
- **The spec format is the central research question.** Nobody knows yet what spec format lets models reliably produce pixel-perfect UI — it must be discovered by running agents, observing failures, and refining. The roadmap must structure this as an empirical loop, not an upfront design task.
- **Verifiers are the feedback mechanism.** Rich, actionable verifier output (e.g. "button padding 12px, expected 16px") is what lets weaker models self-correct. Agent runs the full suite in-loop, any time, until green.
- **Quality bar dimensions:** accessibility, semantic HTML, pixel-perfection, structured design system (atomic design), composability, extensibility.
- **Ground truth model:** spec describes the design; baseline screenshots verify it. Agent works from the spec; VRT confirms the result.

## Constraints

- **Tech stack**: Angular 20 standalone + Storybook 10 + Playwright VRT in init-state; Bun + TypeScript harness — already established, working
- **Verifier interface**: CLI scripts inside the init-state workspace — works identically across all 3 harnesses, no per-harness MCP wiring
- **Models**: Start with Anthropic (Sonnet/Opus, then Haiku as the bar); OpenRouter harnesses enable other models in stage 2
- **Atomic design**: enforced and verified — component structure is scored, not just the rendered pixels

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Spec format discovered empirically, not designed upfront | Nobody knows what spec format works best for models; running agents and iterating is the only way to find out | — Pending |
| Scoring/leaderboard design deferred to its own stage | Wrong to commit before seeing first real results from multiple models | — Pending |
| Verifiers as CLI in init-state (not MCP) | Identical interface across all 3 harnesses; zero per-harness integration work | — Pending |
| Ground truth = spec + baseline screenshots | Spec drives the build (Figma replacement); screenshots give objective VRT verification | — Pending |
| Full verifier suite available in-loop | Rich actionable feedback is what enables weaker models to self-correct to a high bar | — Pending |
| Atomic design structure enforced & verified | Composability/extensibility are first-class quality goals, not just pixels | — Pending |
| Newsletter-form is the single iteration vehicle for stage 1 | Perfect one task end-to-end before scaling task count or model count | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-04 after initialization*
