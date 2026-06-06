#!/usr/bin/env node
/**
 * Browser-based Figma frame export — the /ui-spec Mode C ground-truth path.
 *
 * RUN WITH NODE, NOT BUN: Bun's websocket stack cannot complete
 * playwright-core's CDP handshake (connectOverCDP times out); Node attaches
 * instantly. Node ≥ 23 runs .ts directly (type stripping).
 *
 * Drives a REAL Chrome over raw CDP (no Playwright MCP — it drops connections
 * and leaves hard-to-kill daemons; this is a direct attach that dies with the
 * process). Uses a DEDICATED Chrome profile (~/.figma-chrome) so the user's
 * daily browser is never touched and no profile locks are contested. Login is
 * one-time: the Figma session persists in the profile, after which exports are
 * fully autonomous — and immune to the REST API's per-token rate limits.
 *
 * playwright-core is consumed AS A LIBRARY from the init-state's node_modules
 * (same pattern as crop-atoms.ts borrowing pngjs) — no new root deps.
 *
 * Usage:
 *   bun run scripts/figma-browser.ts ensure-chrome
 *       Launch (or reuse) the dedicated Chrome. First run: log into Figma in
 *       the window that opens, then re-run your export.
 *
 *   bun run scripts/figma-browser.ts inspect <fileKey> [nodeId]
 *       Open the file (optionally selecting a node), print the current
 *       selection's node id + name as you click around the canvas.
 *
 *   bun run scripts/figma-browser.ts export <fileKey> <nodeId> <out.png>
 *       Select the node, drive the export panel, save the @1x PNG to out.png
 *       (Figma text chunks stripped, same as figma-export.ts).
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { chromium } from "../init-states/angular-20-storybook/node_modules/playwright-core/index.mjs";
import { PNG } from "../init-states/angular-20-storybook/node_modules/pngjs/lib/png.js";

const CDP_PORT = 9333;
const PROFILE_DIR = join(homedir(), ".figma-chrome");
const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DOWNLOAD_DIR = join(PROFILE_DIR, "downloads");

// ---------------------------------------------------------------------------
// Chrome lifecycle
// ---------------------------------------------------------------------------

function cdpAlive(): boolean {
  try {
    execSync(`curl -sf http://localhost:${CDP_PORT}/json/version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function ensureChrome(): Promise<void> {
  if (cdpAlive()) {
    console.log(`[figma-browser] Chrome already listening on :${CDP_PORT}`);
    return;
  }
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  console.log(`[figma-browser] launching dedicated Chrome (profile: ${PROFILE_DIR})`);
  const child = spawn(
    CHROME_BIN,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "https://www.figma.com/login",
    ],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (cdpAlive()) {
      console.log("[figma-browser] Chrome up. If this is the first run, log into Figma in that window.");
      return;
    }
  }
  throw new Error("Chrome did not expose CDP within 15s");
}

async function connect() {
  if (!cdpAlive()) await ensureChrome();
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("no browser context — is Chrome running with the dedicated profile?");
  return { browser, ctx };
}

// ---------------------------------------------------------------------------
// Figma navigation
// ---------------------------------------------------------------------------

async function openFile(ctx: Awaited<ReturnType<typeof connect>>["ctx"], fileKey: string, nodeId?: string) {
  const url = `https://www.figma.com/design/${fileKey}/?${nodeId ? `node-id=${nodeId.replace(":", "-")}` : ""}`;
  // Reuse an existing tab on this file if present (canvas loads are expensive).
  let page = ctx.pages().find((p) => p.url().includes(fileKey));
  if (page) {
    if (nodeId) await page.goto(url, { waitUntil: "domcontentloaded" });
  } else {
    page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront();
  // The canvas takes a while; the left panel (real DOM) landing in the tree is
  // the readiness signal. `attached`, not `visible` — Figma's panel positioner
  // wrappers can be zero-size mid-animation and never report visible.
  await page.waitForSelector('[class*="left_panel"], [data-testid="layers-panel"], [class*="objects_panel"]', {
    state: "attached",
    timeout: 60_000,
  });
  return page;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdInspect(fileKey: string, nodeId?: string) {
  const { browser, ctx } = await connect();
  const page = await openFile(ctx, fileKey, nodeId);
  console.log("[inspect] click frames on the canvas; selection is mirrored in the URL. Ctrl+C to stop.");
  let last = "";
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const u = page.url();
    const m = u.match(/node-id=([\d-]+)/);
    if (m && m[1] !== last) {
      last = m[1]!;
      const title = await page.title();
      console.log(`selected node-id=${last.replace("-", ":")}  (page title: ${title})`);
    }
  }
  // unreachable; browser intentionally left open
  void browser;
}

/**
 * Export via Figma's "Copy as PNG" (Cmd+Shift+C) + CDP clipboard read.
 *
 * Proven 2026-06-06 (Footer 175:4454): Copy-as-PNG renders at a FIXED @2x,
 * independent of canvas zoom (verified at 53% zoom → exact 2× node dims).
 * The result is box-filter halved to @1x — deterministic; the residual AA
 * delta vs a native 1x render is the same class as Figma-vs-Chromium glyph
 * AA and is absorbed by calibrated thresholds.
 *
 * HARD RULES (from the Slot-mutation incident, 2026-06-06):
 *   - ZERO canvas position-clicks. Selection happens ONLY via URL node-id;
 *     a blind click once hit a swap-instance control and EDITED the file.
 *   - Verify the URL's node-id equals the requested node before copying;
 *     abort otherwise. Never copy "whatever is selected".
 */
async function cmdExport(fileKey: string, nodeId: string, outPath: string) {
  const { browser, ctx } = await connect();
  const page = await openFile(ctx, fileKey, nodeId);

  const session = await ctx.newCDPSession(page);
  await session.send("Browser.grantPermissions", {
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    origin: "https://www.figma.com",
  } as never);

  // Canvas re-init after navigation; then assert the selection is OUR node.
  await page.waitForTimeout(8000);
  const urlNode = (page.url().match(/node-id=([\d-]+)/) ?? [])[1]?.replace("-", ":");
  if (urlNode !== nodeId) {
    throw new Error(`selection drifted: wanted ${nodeId}, url has ${urlNode ?? "none"} — aborting (never copy blind)`);
  }

  await page.keyboard.press("Meta+Shift+c");
  await page.waitForTimeout(3000);
  const b64 = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("image/png")) {
        const blob = await item.getType("image/png");
        const buf = await blob.arrayBuffer();
        let s = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000)
          s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      }
    }
    return null;
  });
  if (!b64) throw new Error("no image/png on clipboard — Copy as PNG did not fire");

  // @2x → @1x box-filter halve, then strip Figma text chunks (D-05).
  const at2x = PNG.sync.read(Buffer.from(b64, "base64"));
  if (at2x.width % 2 !== 0 || at2x.height % 2 !== 0) {
    throw new Error(`unexpected odd @2x dims ${at2x.width}x${at2x.height}`);
  }
  const out = new PNG({ width: at2x.width / 2, height: at2x.height / 2 });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      for (let c = 0; c < 4; c++) {
        const px = (idx: number) => at2x.data[idx * 4 + c]!;
        const s =
          px(2 * y * at2x.width + 2 * x) +
          px(2 * y * at2x.width + 2 * x + 1) +
          px((2 * y + 1) * at2x.width + 2 * x) +
          px((2 * y + 1) * at2x.width + 2 * x + 1);
        out.data[(y * out.width + x) * 4 + c] = Math.round(s / 4);
      }
    }
  }
  const bytes = stripPngTextChunks(new Uint8Array(PNG.sync.write(out)));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`[export] ${outPath}  ${out.width}x${out.height} @1x  (node ${nodeId}, copied @2x ${at2x.width}x${at2x.height})`);
  await browser.close(); // detaches CDP only; Chrome keeps running
}

// PNG text-chunk stripper — same contract as scripts/figma-export.ts (D-05).
const STRIPPED_CHUNKS = new Set(["tEXt", "iTXt", "zTXt"]);
function stripPngTextChunks(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) break;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (!STRIPPED_CHUNKS.has(type)) parts.push(bytes.slice(offset, chunkEnd));
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "ensure-chrome") {
  await ensureChrome();
} else if (cmd === "inspect" && args[0]) {
  await cmdInspect(args[0], args[1]);
} else if (cmd === "export" && args[0] && args[1] && args[2]) {
  await cmdExport(args[0], args[1], args[2]);
} else {
  console.error("usage: figma-browser.ts ensure-chrome | inspect <fileKey> [nodeId] | export <fileKey> <nodeId> <out.png>");
  process.exit(1);
}
