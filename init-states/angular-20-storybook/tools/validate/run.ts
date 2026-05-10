#!/usr/bin/env bun
/**
 * Validator — soft scoring after verifiers pass.
 *
 *   axe              accessibility violations against the running story
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
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { scanTokens, type TokenViolation } from "./token-scan.ts";

const CWD = process.cwd();
const OUTPUT_DIR = resolve(process.env["BENCH_OUTPUT_DIR"] ?? ".bench");
const STORY_ID = process.env["BENCH_STORY_ID"] ?? "";
const AGENT_DIR = resolve(process.env["BENCH_AGENT_DIR"] ?? "src/lib");
const SKIP_AXE = process.env["BENCH_SKIP_AXE"] === "1";

interface AxeResult {
  ran: boolean;
  violations: Array<{
    id: string;
    impact: string | null;
    help: string;
    nodeCount: number;
  }>;
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

async function runCmd(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<CmdResult> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? CWD,
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

async function runAxe(): Promise<AxeResult> {
  if (SKIP_AXE || !STORY_ID) {
    return {
      ran: false,
      violations: [],
      countsByImpact: {},
      reason: SKIP_AXE ? "skipped via BENCH_SKIP_AXE" : "BENCH_STORY_ID not set",
    };
  }
  if (!existsSync(join(CWD, "storybook-static", "iframe.html"))) {
    return {
      ran: false,
      violations: [],
      countsByImpact: {},
      reason: "storybook-static missing — run verify first",
    };
  }
  const port = 6007;
  const proc: ChildProcess = spawn(
    "npx",
    ["http-server", "storybook-static", "-p", String(port), "-s", "-c-1", "--cors"],
    { cwd: CWD, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/`);
        if (r.ok || r.status === 404) break;
      } catch {
        /* not ready */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const url = `http://127.0.0.1:${port}/iframe.html?id=${encodeURIComponent(
      STORY_ID,
    )}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    await browser.close();
    const countsByImpact: Record<string, number> = {};
    for (const v of results.violations) {
      const k = v.impact ?? "unknown";
      countsByImpact[k] = (countsByImpact[k] ?? 0) + 1;
    }
    return {
      ran: true,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        help: v.help,
        nodeCount: v.nodes.length,
      })),
      countsByImpact,
    };
  } finally {
    proc.kill("SIGTERM");
  }
}

function runTokens(): TokenResult {
  const violations = scanTokens(AGENT_DIR, CWD);
  const countsByKind: Record<string, number> = {};
  for (const v of violations) countsByKind[v.kind] = (countsByKind[v.kind] ?? 0) + 1;
  return { ran: true, count: violations.length, countsByKind, violations };
}

async function runHtmlValidate(): Promise<LintResult> {
  const result = await runCmd(
    "npx",
    [
      "html-validate",
      "--formatter=json",
      `${AGENT_DIR}/**/*.html`,
    ],
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
  const result = await runCmd(
    "npx",
    [
      "stylelint",
      "--formatter=json",
      `${AGENT_DIR}/**/*.{css,scss}`,
    ],
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
  const result = await runCmd(
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
  const result = await runCmd("git", ["diff", "--name-only", "HEAD"], {
    timeoutMs: 30_000,
  });
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

async function main(): Promise<void> {
  const t0 = Date.now();
  const [axe, htmlValidate, stylelint, ngEslint, tamper] = await Promise.all([
    runAxe(),
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
  process.exit(0);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  ensureOutputDir();
  writeFileSync(
    join(OUTPUT_DIR, "validate.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        error: message,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.error("validate failed:", message);
  process.exit(1);
});
