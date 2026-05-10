#!/usr/bin/env bun
/**
 * Verifier — hard acceptance gates.
 *
 *   build   storybook build succeeds
 *   serve   built story renders without console / page / NG errors
 *   vrt     screenshot at 3 viewports matches the task baselines within threshold
 *
 * Inputs (env or CLI args):
 *   BENCH_STORY_ID         storybook story id, e.g. "components-button--default"
 *   BENCH_BASELINES_DIR    path with mobile.png / tablet.png / desktop.png
 *   BENCH_VRT_THRESHOLD    pixel-diff ratio (default 0.02 = 2 %)
 *   BENCH_OUTPUT_DIR       where verify.json goes (default ./.bench)
 *   BENCH_SKIP_BUILD       "1" to reuse storybook-static from a prior run
 *
 * Output: <BENCH_OUTPUT_DIR>/verify.json   (web-codegen-scorer compatible value)
 *         exit 0 if all gates pass, exit 1 otherwise.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type ConsoleMessage, type Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const CWD = process.cwd();
const OUTPUT_DIR = resolve(process.env["BENCH_OUTPUT_DIR"] ?? ".bench");
const STORY_ID = process.env["BENCH_STORY_ID"] ?? "";
const BASELINES_DIR = process.env["BENCH_BASELINES_DIR"] ?? "";
const THRESHOLD = Number(process.env["BENCH_VRT_THRESHOLD"] ?? "0.02");
const SKIP_BUILD = process.env["BENCH_SKIP_BUILD"] === "1";

const VIEWPORTS = [
  { id: "mobile", width: 375, height: 812 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1280, height: 800 },
] as const;

type ViewportId = (typeof VIEWPORTS)[number]["id"];

interface BuildResult {
  pass: boolean;
  durationMs: number;
  exitCode: number | null;
  log?: string;
}

interface ServeResult {
  pass: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  ngWarnings: string[];
  failedRequests: string[];
}

interface VrtViewportResult {
  viewport: ViewportId;
  pass: boolean;
  diffRatio: number | null;
  diffPixels: number | null;
  totalPixels: number | null;
  baselinePath: string;
  actualPath: string;
  diffPath: string | null;
  reason?: string;
}

interface VrtResult {
  pass: boolean;
  threshold: number;
  results: VrtViewportResult[];
}

interface VerifyOutput {
  schemaVersion: 1;
  pass: boolean;
  storyId: string;
  baselinesDir: string;
  durationMs: number;
  build: BuildResult;
  serve: ServeResult | null;
  vrt: VrtResult | null;
}

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeOutput(out: VerifyOutput): void {
  ensureOutputDir();
  writeFileSync(
    join(OUTPUT_DIR, "verify.json"),
    `${JSON.stringify(out, null, 2)}\n`,
    "utf8",
  );
}

async function runStorybookBuild(): Promise<BuildResult> {
  const start = Date.now();
  if (SKIP_BUILD && existsSync(join(CWD, "storybook-static", "iframe.html"))) {
    return { pass: true, durationMs: 0, exitCode: 0, log: "skipped" };
  }
  return new Promise((resolveBuild) => {
    const proc = spawn(
      "npx",
      [
        "storybook",
        "build",
        "--quiet",
        "--output-dir",
        "storybook-static",
      ],
      { cwd: CWD, stdio: ["ignore", "pipe", "pipe"] },
    );
    let buf = "";
    proc.stdout?.on("data", (d) => (buf += String(d)));
    proc.stderr?.on("data", (d) => (buf += String(d)));
    proc.on("exit", (code) => {
      resolveBuild({
        pass: code === 0,
        durationMs: Date.now() - start,
        exitCode: code,
        log: buf.slice(-4000),
      });
    });
  });
}

async function startStaticServer(): Promise<{
  proc: ChildProcess;
  port: number;
  url: string;
}> {
  const port = 6006;
  const proc = spawn(
    "npx",
    [
      "http-server",
      "storybook-static",
      "-p",
      String(port),
      "-s",
      "-c-1",
      "--cors",
    ],
    { cwd: CWD, stdio: ["ignore", "pipe", "pipe"] },
  );
  await waitForPort(port, 30_000);
  return { proc, port, url: `http://127.0.0.1:${port}` };
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok || res.status === 404) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`http-server on :${port} never became ready`);
}

const NG_WARNING_RE = /\bNG0\d{3,4}\b/;

async function captureStoryErrors(
  page: Page,
  storyUrl: string,
  idleMs = 2000,
): Promise<{
  consoleErrors: string[];
  pageErrors: string[];
  ngWarnings: string[];
  failedRequests: string[];
}> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const ngWarnings: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (msg: ConsoleMessage): void => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (NG_WARNING_RE.test(text)) ngWarnings.push(text);
  };
  const onPageError = (err: Error): void => {
    pageErrors.push(`${err.name}: ${err.message}`);
  };
  const onResponse = async (response: {
    status: () => number;
    url: () => string;
  }): Promise<void> => {
    const status = response.status();
    if (status >= 400) failedRequests.push(`${status} ${response.url()}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  await page.goto(storyUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(idleMs);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  return { consoleErrors, pageErrors, ngWarnings, failedRequests };
}

async function killAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function screenshotViewport(
  storyUrl: string,
  vp: (typeof VIEWPORTS)[number],
  outPath: string,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(storyUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await killAnimations(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();
}

function diffScreenshots(
  baselinePath: string,
  actualPath: string,
  diffPath: string,
): { diffPixels: number; totalPixels: number; diffRatio: number } | null {
  if (!existsSync(baselinePath) || !existsSync(actualPath)) return null;
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(readFileSync(actualPath));
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return {
      diffPixels: -1,
      totalPixels: baseline.width * baseline.height,
      diffRatio: 1,
    };
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const diffPixels = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 },
  );
  writeFileSync(diffPath, PNG.sync.write(diff));
  const totalPixels = baseline.width * baseline.height;
  return { diffPixels, totalPixels, diffRatio: diffPixels / totalPixels };
}

async function main(): Promise<void> {
  const t0 = Date.now();
  ensureOutputDir();

  const baseOutput: Omit<VerifyOutput, "build" | "serve" | "vrt" | "pass" | "durationMs"> = {
    schemaVersion: 1,
    storyId: STORY_ID,
    baselinesDir: BASELINES_DIR,
  };

  // ---------- 1. build ----------
  const build = await runStorybookBuild();
  if (!build.pass) {
    writeOutput({
      ...baseOutput,
      pass: false,
      durationMs: Date.now() - t0,
      build,
      serve: null,
      vrt: null,
    });
    process.exit(1);
  }

  if (!STORY_ID) {
    writeOutput({
      ...baseOutput,
      pass: false,
      durationMs: Date.now() - t0,
      build,
      serve: {
        pass: false,
        consoleErrors: ["BENCH_STORY_ID not set"],
        pageErrors: [],
        ngWarnings: [],
        failedRequests: [],
      },
      vrt: null,
    });
    process.exit(1);
  }

  // ---------- 2. serve + capture errors ----------
  const server = await startStaticServer();
  const storyUrl = `${server.url}/iframe.html?id=${encodeURIComponent(
    STORY_ID,
  )}&viewMode=story`;

  let serve: ServeResult;
  let vrt: VrtResult;
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const captured = await captureStoryErrors(page, storyUrl);
    await browser.close();
    serve = { pass: false, ...captured };
    serve.pass =
      serve.consoleErrors.length === 0 &&
      serve.pageErrors.length === 0 &&
      serve.ngWarnings.length === 0 &&
      serve.failedRequests.length === 0;

    // ---------- 3. vrt ----------
    if (!serve.pass) {
      vrt = { pass: false, threshold: THRESHOLD, results: [] };
    } else if (!BASELINES_DIR) {
      vrt = {
        pass: false,
        threshold: THRESHOLD,
        results: VIEWPORTS.map((v) => ({
          viewport: v.id,
          pass: false,
          diffRatio: null,
          diffPixels: null,
          totalPixels: null,
          baselinePath: "",
          actualPath: "",
          diffPath: null,
          reason: "BENCH_BASELINES_DIR not set",
        })),
      };
    } else {
      const results: VrtViewportResult[] = [];
      const actualDir = join(OUTPUT_DIR, "actual");
      const diffDir = join(OUTPUT_DIR, "diff");
      mkdirSync(actualDir, { recursive: true });
      mkdirSync(diffDir, { recursive: true });
      for (const vp of VIEWPORTS) {
        const baselinePath = resolve(BASELINES_DIR, `${vp.id}.png`);
        const actualPath = join(actualDir, `${vp.id}.png`);
        const diffPath = join(diffDir, `${vp.id}.png`);
        if (!existsSync(baselinePath)) {
          results.push({
            viewport: vp.id,
            pass: false,
            diffRatio: null,
            diffPixels: null,
            totalPixels: null,
            baselinePath,
            actualPath,
            diffPath: null,
            reason: "baseline missing",
          });
          continue;
        }
        await screenshotViewport(storyUrl, vp, actualPath);
        const diff = diffScreenshots(baselinePath, actualPath, diffPath);
        if (diff === null) {
          results.push({
            viewport: vp.id,
            pass: false,
            diffRatio: null,
            diffPixels: null,
            totalPixels: null,
            baselinePath,
            actualPath,
            diffPath: null,
            reason: "diff failed",
          });
          continue;
        }
        results.push({
          viewport: vp.id,
          pass: diff.diffRatio <= THRESHOLD,
          diffRatio: diff.diffRatio,
          diffPixels: diff.diffPixels,
          totalPixels: diff.totalPixels,
          baselinePath,
          actualPath,
          diffPath,
          ...(diff.diffPixels === -1
            ? { reason: "viewport size mismatch with baseline" }
            : {}),
        });
      }
      vrt = {
        pass: results.every((r) => r.pass),
        threshold: THRESHOLD,
        results,
      };
    }
  } finally {
    server.proc.kill("SIGTERM");
  }

  const out: VerifyOutput = {
    ...baseOutput,
    pass: build.pass && serve.pass && vrt.pass,
    durationMs: Date.now() - t0,
    build,
    serve,
    vrt,
  };
  writeOutput(out);
  process.exit(out.pass ? 0 : 1);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  ensureOutputDir();
  writeFileSync(
    join(OUTPUT_DIR, "verify.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        pass: false,
        error: message,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.error("verify failed:", message);
  process.exit(1);
});
