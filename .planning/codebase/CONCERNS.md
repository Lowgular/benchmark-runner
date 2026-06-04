# Codebase Concerns

**Analysis Date:** 2026-06-04

## Tech Debt

**Legacy task-runners coexist with the active harness pipeline:**
- Issue: `task-runners/plan-and-find/`, `task-runners/plan-and-find-claude/`, and `task-runners/plan-and-find-claude-qmd/` are described as "LEGACY — deprecating slowly" in the README, but all three remain fully functional, uncommitted-from, and contain their own deps and build configs. There is no removal schedule or marker.
- Files: `task-runners/plan-and-find/src/main.ts`, `task-runners/plan-and-find-claude/src/main.ts`, `task-runners/plan-and-find-claude-qmd/src/main.ts`
- Impact: New contributors cannot tell which runner to use. Bugs fixed in the active `harness/` pipeline may not be patched in legacy runners, causing divergent behavior across benchmark history.
- Fix approach: Mark each legacy runner with a top-level `DEPRECATED.md` or banner comment, then remove after existing benchmark data is no longer needed for comparison.

**`parseAgentFile` duplicated across three files with slightly different implementations:**
- Issue: The function that parses YAML frontmatter from agent `.md` files is independently written three times. `harness/framework.ts` uses `yaml` library; `task-runners/plan-and-find-claude/src/main.ts` and `task-runners/plan-and-find-claude-qmd/src/main.ts` use manual regex.
- Files: `harness/framework.ts:78`, `task-runners/plan-and-find-claude/src/main.ts:48`, `task-runners/plan-and-find-claude-qmd/src/main.ts:47`
- Impact: Parsing edge cases (e.g. multi-line values, CRLF) are handled differently across runners. A fix in one location does not propagate.
- Fix approach: Extract to a shared `harness/agent-parser.ts` module and import from all three.

**Model alias tables duplicated — PARTIALLY FIXED 2026-06-04 (legacy runners remain):**
- Resolution (active pipeline): centralized in `harness/models.ts` (`MODEL_ALIASES` + `OPENROUTER_MODEL_MAP`); `framework.ts`, `ai-sdk`, and `deepagents` all import from it. Also fixed the mislabels: OpenRouter slugs were `anthropic/claude-sonnet-4.5` for `claude-sonnet-4-6` and `anthropic/claude-opus-4.5` for `claude-opus-4-7` — both now map to the correct `4.6`/`4.7` slugs (verified against openrouter.ai), so OpenRouter benchmarks were previously running older models than labeled.
- Remaining: legacy `task-runners/plan-and-find-claude/src/main.ts:31-35` and `task-runners/plan-and-find-claude-qmd/src/main.ts:30-34` still carry their own copies (deliberately untouched — legacy runners are frozen).

**`eval-runner` is labeled LEGACY in the README but its `dist/` build output is committed:**
- Issue: `eval-runner/dist/` contains compiled JS that diverges from `src/` whenever source changes without a rebuild. The `dist/` directory is not in `.gitignore` for `eval-runner`.
- Files: `eval-runner/dist/main.js`, `eval-runner/dist/ratings/`, `eval-runner/src/main.ts`
- Impact: Running `node dist/main.js` may use stale logic. PRs that only edit `src/` will appear correct but ship broken behavior.
- Fix approach: Add `eval-runner/dist/` to `.gitignore` and add a `prebuild` CI step, or migrate to the planned Pass-2 eval script.

**Legacy `environments/` directory references a broken local file dependency:**
- Issue: `package.json` at repo root includes `"@lowgular/wcs-ratings": "file:../../../../lowgular-internal/dist/apps/wcs-ratings"`. This path does not exist on the filesystem (confirmed missing). The `environments/` configs depend on this package.
- Files: `package.json:8`, `environments/angular-20-greenfield/config.js`, `environments/angular-20-greenfield-hard/config.js`, `environments/angular-20-legacy/config.js`
- Impact: Any contributor running `npm install` from the repo root gets an install failure. Environments are described as "LEGACY — unused" in the README but the broken dep is still present.
- Fix approach: Remove the broken local path dep from `package.json` or relocate `environments/` to an archived branch.

**`run_task.sh` only supports the `vrt` bench hardcoded in a `case` statement:**
- Issue: Five task bench types exist under `tasks/` (`code-graph`, `entry`, `refactor`, `rules`, `wcs`) but `run_task.sh` only knows `vrt`. Any other bench fails with "Unknown bench".
- Files: `run_task.sh:37-46`, `tasks/code-graph/`, `tasks/entry/`, `tasks/refactor/`, `tasks/rules/`, `tasks/wcs/`
- Impact: All non-VRT tasks require ad-hoc runner invocation via legacy task-runners, not the unified harness. Discoverability is zero.
- Fix approach: Either generalize `run_task.sh` to accept configurable `--agent` per bench, or document the per-bench invocation pattern in README.

**Duplicate AGENTS.md files with divergent content for `plan-and-find`:**
- Issue: Agent definitions exist at two paths and they differ. `task-runners/plan-and-find/agents/code-graph/AGENTS.md` has additional Cypher variable binding rules and multi-call decomposition guidance that are missing from `task-runners/plan-and-find/src/agents/code-graph/AGENTS.md`.
- Files: `task-runners/plan-and-find/agents/code-graph/AGENTS.md`, `task-runners/plan-and-find/src/agents/code-graph/AGENTS.md`
- Impact: Depending on which path is resolved at runtime, the agent receives different instructions. The newer, more capable rules may silently not apply.
- Fix approach: Delete the older `src/agents/` copy and canonicalize on `agents/`.

**Plain JS file among TypeScript sources:**
- Issue: `task-runners/plan-and-find/src/response-to-markdown.js` is a CommonJS script checked in alongside `.ts` files. It uses `require()` while the project is `"type": "commonjs"`, but it is never imported by TypeScript sources — it is a standalone CLI script.
- Files: `task-runners/plan-and-find/src/response-to-markdown.js`
- Impact: TypeScript compiler does not type-check it. Duplicated logic with `task-runners/plan-and-find/src/response-markdown.ts` which implements the same transform.
- Fix approach: Remove `response-to-markdown.js` or convert to TypeScript and unify with `response-markdown.ts`.

## Known Bugs

**~~`write-summary.ts` silently emits empty `prompt` field for VRT tasks~~ (FIXED 2026-06-04):**
- Resolution: `framework.ts` now writes `summary.json` itself from the task file it already read (`--run-id`/`--init-state` flags), so the prompt is always populated. The standalone regen tool `write-summary.ts` also checks both `tasks/<task>/<task>.md` and `tasks/<task>.md`.

**~~`deepagents` harness always emits `isError: false` for tool results~~ (FIXED 2026-06-04):**
- Resolution: `isError` now maps `ToolMessage.status === "error"` (`harness/deepagents/src/index.ts`).

**~~`run_task.sh` elapsed timing has 1-second granularity~~ (FIXED 2026-06-04):**
- Resolution: shell timing removed; `framework.ts` measures `elapsedMs` in-process with `Date.now()` (millisecond resolution) and writes it into `summary.json` directly.

## Security Considerations

**`permissionMode: "bypassPermissions"` granted to all agents unconditionally:**
- Risk: Agents can read, write, and execute any file accessible to the process. The `anthropic-sdk` harness sets this on every run without scope restriction.
- Files: `harness/anthropic-sdk/src/index.ts:43`, `task-runners/plan-and-find-claude/src/main.ts:183`
- Current mitigation: Runs are isolated to per-GUID directories under `runs/`. However, the agent's `cwd` is the run directory, and bypass permissions means it can traverse the filesystem.
- Recommendations: Scope with `allowedTools` to restrict Bash/file operations where possible; document the intentional bypass decision in code comments.

**Full parent `process.env` forwarded to MCP server subprocess:**
- Risk: Any secrets in the shell environment (API keys, tokens) are inherited by the MCP server process, which runs as a subprocess of the runner.
- Files: `task-runners/plan-and-find-claude/src/main.ts:191`, `task-runners/plan-and-find-claude-qmd/src/main.ts:159`
- Current mitigation: The MCP server is a local bun subprocess, not an external service.
- Recommendations: Forward only required env vars (`MCP_CATALOG_DIR`, `MCP_PROJECT_DIR`) rather than the full environment spread.

## Performance Bottlenecks

**`runs/` directory accumulates 6.7 GB of workspace data:**
- Problem: Each benchmark run rsync-copies a full init-state (~200MB+ with `node_modules`) into a GUID-named directory. No cleanup is performed after runs.
- Files: `run_task.sh:72,75`, `runs/` (6.7 GB on disk)
- Cause: `npm ci` runs inside each ephemeral `runs/<bench>/<task>/<guid>/` directory, creating a full `node_modules` tree per run.
- Note: As of 2026-06-04 this is a disk-only concern — `runs/` is gitignored (commit `da6b56f`) and no longer affects the repo.
- Improvement path: Use a shared `node_modules` cache via `npm ci --cache`, or rsync without copying `node_modules` and symlink to a shared install. Add a `cleanup` script or document manual pruning.

**`npm ci` runs on every benchmark run regardless of whether packages changed:**
- Problem: Each `run_task.sh` invocation runs `npm ci --no-audit --no-fund` unconditionally, adding 30–90 seconds per run. (Switched from `npm install` to `npm ci` 2026-06-04 for reproducible installs; the per-run cost remains.)
- Files: `run_task.sh`
- Cause: The rsync of the init-state does not preserve the `node_modules` — they are gitignored and thus filtered from the rsync.
- Improvement path: Pre-build init-state tarballs with `node_modules` baked in, or use `--offline` with a pre-populated npm cache.

## Fragile Areas

**Response parsing in `eval-runner/src/main.ts` depends on brittle `## Final Answer` section header:**
- Files: `eval-runner/src/main.ts:92-114`
- Why fragile: `parseActualNodesFromResponse` searches for the literal string `## Final Answer` in RESPONSE.md using `lastIndexOf`. If an agent uses a different heading, uses a code block, or adds a suffix (e.g. `## Final Answer (revised)`), the entire parse fails with a thrown error.
- Safe modification: The format contract is only documented implicitly through the agent's system prompt. Any change to agent output format silently breaks eval scoring.
- Test coverage: No unit tests for `parseActualNodesFromResponse`. The eval-runner has zero test files.

**`emptyDirectoryInPlace` in workspace.ts destroys the entire working directory:**
- Files: `task-runners/plan-and-find/src/workspace.ts:37-42`
- Why fragile: The function `rmSync(p, { recursive: true, force: true })` on every entry in `process.cwd()` including hidden files. If the GUID regex check (`getTaskRunIdFromCwd`) ever fails (e.g. CWD name is not a valid UUID), the caller throws before reaching `emptyDirectoryInPlace`, but there is no defense-in-depth.
- Safe modification: Do not call `emptyDirectoryInPlace` if any pre-condition check has uncertain output.
- Test coverage: None.

**`run-models.sh` contains a hardcoded model list managed by manual commenting:**
- Files: `runs/refactor-angular-entry/run-models.sh`
- Why fragile: Selecting which models to benchmark requires manually commenting/uncommenting lines in a shell script. There is no config file, no validation, and no feedback if a model ID is misspelled.
- Safe modification: Replace with a JSON/YAML model list and a loop that reads it.

## Scaling Limits

**~~Git repo will grow unboundedly with committed run artifacts~~ — RESOLVED (2026-06-04, commit `da6b56f`):**
- Resolution: `runs/` added to `.gitignore` and all 11,489 tracked run artifacts removed from the index (repo now tracks 332 files). Run results are standardized in backend storage (Firebase/Supabase); local `runs/` dirs remain on disk for short-term harness tuning inspection only. Old run data stays reachable in git history.
- Remaining: disk-space accumulation in `runs/` is still an open concern (see Performance Bottlenecks).

**`stopWhen: stepCountIs(50)` hard-limits the AI SDK harness:**
- Current capacity: 50 agent steps maximum per run.
- Limit: Complex tasks requiring more reasoning cycles silently truncate. The agent does not know it was cut off.
- Scaling path: Make the step limit configurable via `HarnessParams` or a CLI flag.

## Dependencies at Risk

**`@lowgular/wcs-ratings` is a local `file:` dependency that does not exist:**
- Risk: The path `../../../../lowgular-internal/dist/apps/wcs-ratings` is machine-specific and does not exist on this filesystem. Any `npm install` at the repo root fails.
- Impact: The `environments/` configs break. Anyone cloning the repo cannot install.
- Migration plan: Either publish to a private registry, remove the dependency entirely (environments are labeled LEGACY), or replace with a checked-in stub.

**`deepagents` package is an internal/private package with no public registry listing:**
- Risk: `deepagents: ^1.9.0` appears in `task-runners/plan-and-find/package.json` and `harness/package.json`. If the package source changes its API, pinned consumers break silently on the next `npm install`.
- Impact: `task-runners/plan-and-find/src/main.ts` depends on `createDeepAgent`, `LocalShellBackend` from this package.
- Migration plan: Pin to an exact version; add a lockfile check in CI.

## Test Coverage Gaps

**`eval-runner` has zero tests:**
- What's not tested: `parseActualNodesFromResponse`, `evaluate`, `enrichSummaryWithAssessments`, `normalizeNode`, `toNodeKey`, `buildAssessments`.
- Files: `eval-runner/src/main.ts`, `eval-runner/src/ratings/per-build/precision.metric.ts`, `eval-runner/src/ratings/per-build/recall.metric.ts`, `eval-runner/src/ratings/node-match.utils.ts`
- Risk: Scoring logic (precision, recall, false positive/negative classification) can silently regress. A format change in RESPONSE.md would silently produce 0-score results.
- Priority: High — this is the ground truth scorer for the entire benchmark.

**`harness/` framework and harness plug-ins have almost zero tests:**
- Covered: harness plugin contract (`harness/harness-contract.test.ts` — no fs/CLI/console in plugins, type-only framework imports; run via `bun test harness/`).
- What's not tested: `parseAgentFile`, `resolveModel`, `parseArgs`, `buildSummary`, message normalization in all three harnesses, `writeResponseMarkdownFromJsonl`.
- Files: `harness/framework.ts`, `harness/anthropic-sdk/src/index.ts`, `harness/ai-sdk/src/index.ts`, `harness/deepagents/src/index.ts`, `task-runners/plan-and-find/src/response-markdown.ts`
- Risk: YAML frontmatter parsing regressions, broken model alias resolution, and incorrect JSONL event serialization will only be caught at runtime against a live model API.
- Priority: Medium — at minimum, `parseAgentFile` and `resolveModel` are pure functions that should have unit tests.

**`workspace.ts` destructive operations have zero tests:**
- What's not tested: `emptyDirectoryInPlace`, `copyInitStateIntoWorkspace`, `getTaskRunIdFromCwd`.
- Files: `task-runners/plan-and-find/src/workspace.ts`
- Risk: A regression in `emptyDirectoryInPlace` could silently wipe unintended directories.
- Priority: High — destructive file system operations without tests are inherently dangerous.

---

*Concerns audit: 2026-06-04*
