#!/usr/bin/env bun
/**
 * Validator — soft scoring after verifiers pass.
 *
 *   axe              accessibility violations against the running story
 *                    (delegates to tools/validate/axe.spec.ts via @playwright/test
 *                    so the user sees a nice live report; pass criterion is
 *                    zero violations against WCAG 2.1 AAA + best-practice)
 *   tokens           regex/AST scan for arbitrary values & inline styles
 *   htmlValidate     semantic HTML linting
 *   stylelint        CSS quality (banning !important, inline-style escape hatches)
 *   ngEslint         angular-eslint + TS hygiene (no `any`, OnPush, signals)
 *   tamper           git diff vs scaffold (logged, not gated)
 *
 * Inputs (env or CLI args):
 *   BENCH_STORY_ID         storybook story id, e.g. "components-button--default"
 *   BENCH_AGENT_DIR        path to agent's component dir (default src/lib)
 *   BENCH_OUTPUT_DIR       where validate.json goes (default ./.bench)
 *   BENCH_SKIP_AXE         "1" to skip axe (no live story available)
 *
 * Output: <BENCH_OUTPUT_DIR>/validate.json
 *         exit 0 always (this is a SCORE, not a gate); the verifier is the gate.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { scanTokens, type TokenViolation } from "./token-scan";

const CWD = process.cwd();
const OUTPUT_DIR = resolve(process.env["BENCH_OUTPUT_DIR"] ?? ".bench");
const STORY_ID = process.env["BENCH_STORY_ID"] ?? "";
const AGENT_DIR = resolve(process.env["BENCH_AGENT_DIR"] ?? "src/lib");
const SKIP_AXE = process.env["BENCH_SKIP_AXE"] === "1";

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodeCount: number;
}

interface AxeResult {
  ran: boolean;
  aaaPassed: boolean;
  violations: AxeViolation[];
  countsByImpact: Record<string, number>;
  reason?: string;
}

interface LintResult {
  ran: boolean;
  errorCount: number;
  warningCount: number;
  messages: Array<{
    file?: string;
    line?: number;
    column?: number;
    severity: "error" | "warning";
    rule?: string;
    message: string;
  }>;
  reason?: string;
}

interface TokenResult {
  ran: boolean;
  count: number;
  countsByKind: Record<string, number>;
  violations: TokenViolation[];
}

interface TamperResult {
  ran: boolean;
  modifiedFiles: string[];
  reason?: string;
}

interface ValidateOutput {
  schemaVersion: 1;
  storyId: string;
  agentDir: string;
  durationMs: number;
  axe: AxeResult;
  tokens: TokenResult;
  htmlValidate: LintResult;
  stylelint: LintResult;
  ngEslint: LintResult;
  tamper: TamperResult;
}

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeOutput(out: ValidateOutput): void {
  ensureOutputDir();
  writeFileSync(
    join(OUTPUT_DIR, "validate.json"),
    `${JSON.stringify(out, null, 2)}\n`,
    "utf8",
  );
}

interface CmdResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

async function runCmdInherit(
  cmd: string,
  args: string[],
): Promise<{ exitCode: number | null }> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, {
      cwd: CWD,
      stdio: "inherit",
      env: process.env,
    });
    proc.on("exit", (exitCode) => res({ exitCode }));
  });
}

async function runCmdCapture(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number } = {},
): Promise<CmdResult> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, {
      cwd: CWD,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += String(d)));
    proc.stderr?.on("data", (d) => (stderr += String(d)));
    const t = opts.timeoutMs
      ? setTimeout(() => proc.kill("SIGKILL"), opts.timeoutMs)
      : null;
    proc.on("exit", (code) => {
      if (t) clearTimeout(t);
      res({ exitCode: code, stdout, stderr });
    });
  });
}

async function runAxeViaPlaywright(): Promise<AxeResult> {
  if (SKIP_AXE) {
    return {
      ran: false,
      aaaPassed: false,
      violations: [],
      countsByImpact: {},
      reason: "skipped via BENCH_SKIP_AXE",
    };
  }
  if (!STORY_ID) {
    return {
      ran: false,
      aaaPassed: false,
      violations: [],
      countsByImpact: {},
      reason: "BENCH_STORY_ID not set",
    };
  }
  if (!existsSync(join(CWD, "storybook-static", "iframe.html"))) {
    return {
      ran: false,
      aaaPassed: false,
      violations: [],
      countsByImpact: {},
      reason: "storybook-static missing — run `npm run build` first",
    };
  }

  console.error("─── axe (playwright + WCAG AAA) " + "─".repeat(40));
  const { exitCode } = await runCmdInherit("npx", [
    "playwright",
    "test",
    "tools/validate/axe.spec.ts",
  ]);
  console.error("─".repeat(72) + "\n");

  const axeResultPath = join(OUTPUT_DIR, "axe-result.json");
  if (!existsSync(axeResultPath)) {
    return {
      ran: true,
      aaaPassed: exitCode === 0,
      violations: [],
      countsByImpact: {},
      reason: "axe-result.json not written by spec",
    };
  }
  const full = JSON.parse(readFileSync(axeResultPath, "utf8")) as {
    violations: Array<{
      id: string;
      impact: string | null;
      help: string;
      nodes: unknown[];
    }>;
  };
  const countsByImpact: Record<string, number> = {};
  for (const v of full.violations) {
    const k = v.impact ?? "unknown";
    countsByImpact[k] = (countsByImpact[k] ?? 0) + 1;
  }
  return {
    ran: true,
    aaaPassed: exitCode === 0,
    violations: full.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodeCount: v.nodes.length,
    })),
    countsByImpact,
  };
}

function runTokens(): TokenResult {
  const violations = scanTokens(AGENT_DIR, CWD);
  const countsByKind: Record<string, number> = {};
  for (const v of violations) countsByKind[v.kind] = (countsByKind[v.kind] ?? 0) + 1;
  return { ran: true, count: violations.length, countsByKind, violations };
}

async function runHtmlValidate(): Promise<LintResult> {
  const result = await runCmdCapture(
    "npx",
    ["html-validate", "--formatter=json", `${AGENT_DIR}/**/*.html`],
    { timeoutMs: 60_000 },
  );
  if (!result.stdout.trim()) {
    return { ran: true, errorCount: 0, warningCount: 0, messages: [] };
  }
  try {
    const parsed = JSON.parse(result.stdout) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        severity: number;
        ruleId: string;
        message: string;
      }>;
    }>;
    const messages: LintResult["messages"] = [];
    let errorCount = 0;
    let warningCount = 0;
    for (const file of parsed) {
      for (const m of file.messages) {
        const severity: "error" | "warning" = m.severity >= 2 ? "error" : "warning";
        if (severity === "error") errorCount++;
        else warningCount++;
        messages.push({
          file: file.filePath,
          line: m.line,
          column: m.column,
          severity,
          rule: m.ruleId,
          message: m.message,
        });
      }
    }
    return { ran: true, errorCount, warningCount, messages };
  } catch (err) {
    return {
      ran: false,
      errorCount: 0,
      warningCount: 0,
      messages: [],
      reason: `parse failed: ${(err as Error).message}`,
    };
  }
}

async function runStylelint(): Promise<LintResult> {
  const result = await runCmdCapture(
    "npx",
    ["stylelint", "--formatter=json", `${AGENT_DIR}/**/*.{css,scss}`],
    { timeoutMs: 60_000 },
  );
  if (!result.stdout.trim()) {
    return { ran: true, errorCount: 0, warningCount: 0, messages: [] };
  }
  try {
    const parsed = JSON.parse(result.stdout) as Array<{
      source: string;
      warnings: Array<{
        line: number;
        column: number;
        severity: "error" | "warning";
        rule: string;
        text: string;
      }>;
    }>;
    const messages: LintResult["messages"] = [];
    let errorCount = 0;
    let warningCount = 0;
    for (const file of parsed) {
      for (const w of file.warnings) {
        if (w.severity === "error") errorCount++;
        else warningCount++;
        messages.push({
          file: file.source,
          line: w.line,
          column: w.column,
          severity: w.severity,
          rule: w.rule,
          message: w.text,
        });
      }
    }
    return { ran: true, errorCount, warningCount, messages };
  } catch (err) {
    return {
      ran: false,
      errorCount: 0,
      warningCount: 0,
      messages: [],
      reason: `parse failed: ${(err as Error).message}`,
    };
  }
}

async function runNgEslint(): Promise<LintResult> {
  const result = await runCmdCapture(
    "npx",
    [
      "eslint",
      "--format=json",
      "--no-error-on-unmatched-pattern",
      `${AGENT_DIR}/**/*.{ts,html}`,
    ],
    { timeoutMs: 90_000 },
  );
  if (!result.stdout.trim()) {
    return {
      ran: false,
      errorCount: 0,
      warningCount: 0,
      messages: [],
      reason: "eslint produced no output",
    };
  }
  try {
    const parsed = JSON.parse(result.stdout) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        severity: number;
        ruleId: string | null;
        message: string;
      }>;
    }>;
    const messages: LintResult["messages"] = [];
    let errorCount = 0;
    let warningCount = 0;
    for (const file of parsed) {
      for (const m of file.messages) {
        const severity: "error" | "warning" = m.severity >= 2 ? "error" : "warning";
        if (severity === "error") errorCount++;
        else warningCount++;
        messages.push({
          file: file.filePath,
          line: m.line,
          column: m.column,
          severity,
          ...(m.ruleId ? { rule: m.ruleId } : {}),
          message: m.message,
        });
      }
    }
    return { ran: true, errorCount, warningCount, messages };
  } catch (err) {
    return {
      ran: false,
      errorCount: 0,
      warningCount: 0,
      messages: [],
      reason: `parse failed: ${(err as Error).message}`,
    };
  }
}

async function runTamper(): Promise<TamperResult> {
  if (!existsSync(join(CWD, ".git"))) {
    return { ran: false, modifiedFiles: [], reason: ".git not present" };
  }
  const result = await runCmdCapture(
    "git",
    ["diff", "--name-only", "HEAD"],
    { timeoutMs: 30_000 },
  );
  if (result.exitCode !== 0) {
    return {
      ran: false,
      modifiedFiles: [],
      reason: `git diff exit ${result.exitCode}: ${result.stderr.slice(0, 200)}`,
    };
  }
  const allChanged = result.stdout.split("\n").filter(Boolean);
  const agentRel = AGENT_DIR.replace(`${CWD}/`, "").replaceAll("\\", "/");
  const outsideAgent = allChanged.filter(
    (f) => !f.startsWith(agentRel) && !f.startsWith(".bench/"),
  );
  return { ran: true, modifiedFiles: outsideAgent };
}

function printSummary(out: ValidateOutput): void {
  console.error("─── validate summary ".padEnd(72, "─"));
  const fmt = (label: string, body: string): void =>
    console.error(`  ${label.padEnd(14)} ${body}`);

  fmt(
    "axe",
    out.axe.ran
      ? `${out.axe.aaaPassed ? "PASS (AAA)" : "FAIL"} — ${out.axe.violations.length} violation(s) ${
          out.axe.violations.length
            ? `(${Object.entries(out.axe.countsByImpact)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ")})`
            : ""
        }`
      : `skipped — ${out.axe.reason ?? "unknown"}`,
  );
  fmt(
    "tokens",
    out.tokens.count === 0
      ? "PASS — no arbitrary values or inline styles"
      : `${out.tokens.count} violation(s) (${Object.entries(out.tokens.countsByKind)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ")})`,
  );
  fmt(
    "html-validate",
    out.htmlValidate.ran
      ? `${out.htmlValidate.errorCount} error(s), ${out.htmlValidate.warningCount} warning(s)`
      : `not run — ${out.htmlValidate.reason ?? "unknown"}`,
  );
  fmt(
    "stylelint",
    out.stylelint.ran
      ? `${out.stylelint.errorCount} error(s), ${out.stylelint.warningCount} warning(s)`
      : `not run — ${out.stylelint.reason ?? "unknown"}`,
  );
  fmt(
    "ng-eslint",
    out.ngEslint.ran
      ? `${out.ngEslint.errorCount} error(s), ${out.ngEslint.warningCount} warning(s)`
      : `not run — ${out.ngEslint.reason ?? "unknown"}`,
  );
  fmt(
    "tamper",
    out.tamper.ran
      ? out.tamper.modifiedFiles.length === 0
        ? "no scaffold modifications"
        : `${out.tamper.modifiedFiles.length} file(s) modified outside agent dir`
      : `not run — ${out.tamper.reason ?? "unknown"}`,
  );
  console.error(`  ${"".padEnd(14)} (${out.durationMs} ms)`);
  console.error("─".repeat(72));
  console.error(`  full report: ${join(OUTPUT_DIR, "validate.json")}`);
  if (out.axe.ran && existsSync(join(OUTPUT_DIR, "playwright-report"))) {
    console.error(
      `  axe HTML report: npx playwright show-report ${join(OUTPUT_DIR, "playwright-report")}`,
    );
  }
}

async function main(): Promise<void> {
  const t0 = Date.now();

  // axe is run first so its live output streams to the user before the
  // static linters' aggregated summary.
  const axe = await runAxeViaPlaywright();

  const [htmlValidate, stylelint, ngEslint, tamper] = await Promise.all([
    runHtmlValidate(),
    runStylelint(),
    runNgEslint(),
    runTamper(),
  ]);
  const tokens = runTokens();

  const out: ValidateOutput = {
    schemaVersion: 1,
    storyId: STORY_ID,
    agentDir: AGENT_DIR,
    durationMs: Date.now() - t0,
    axe,
    tokens,
    htmlValidate,
    stylelint,
    ngEslint,
    tamper,
  };
  writeOutput(out);
  printSummary(out);
  process.exit(0);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  ensureOutputDir();
  writeFileSync(
    join(OUTPUT_DIR, "validate.json"),
    `${JSON.stringify({ schemaVersion: 1, error: message }, null, 2)}\n`,
    "utf8",
  );
  console.error("validate failed:", message);
  process.exit(1);
});
