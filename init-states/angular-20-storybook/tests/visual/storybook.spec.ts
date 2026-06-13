// Visual regression sweep for every Storybook story across two breakpoints.
//
// Stories are discovered by listing subdirectories under tests/visual/ —
// each subfolder name is treated as a Storybook story id (the value of
// `?id=` in the Storybook iframe URL). The folder holds the baselines:
//
//   tests/visual/<story-id>/
//     ├── mobile.png    (375px — required for page/composition stories)
//     ├── desktop.png   (1200px — required for page/composition stories)
//     └── capture.json  (optional override: {"capture": "page" | "element"})
//
// A story dir that ships only mobile.png is diffed only at mobile — atoms and
// molecules can ship fewer than both breakpoints (VERIFY-02). Only the
// viewports whose <viewport>.png file exists in the story dir are tested.
//
// Capture modes, by story-id convention (capture.json overrides):
//   "page"    (default for pages-*) — fullPage screenshot at viewport width,
//              for stories whose baseline is a full-width design export.
//   "element" (default for atoms-/molecules-/layouts-) — screenshot of the
//              first rendered element inside #storybook-root (the component
//              host). The baseline is the component's natural-size design
//              export; the diff fails on any size mismatch, which tells the
//              agent its component dimensions are off.
//
// Per-story thresholds are loaded from thresholds.json: a task-level "default"
// and optional per-story "overrides" (D-04). The playwright.config global
// maxDiffPixelRatio is the final fallback.
//
// Pre-requisite: `npm run build` so storybook-static/ exists. The Playwright
// webServer config will boot http-server against it. Failed diffs surface in
// test-results/SUMMARY.md and the HTML report at test-results/html/.

import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VISUAL_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(VISUAL_DIR, "..", "stories", "expected.json");

// Two breakpoints per D-02: mobile 375 + desktop 1200. Tablet (768) dropped.
// Only `width` drives layout. Captures use `fullPage: true` (see below), which
// records the entire document scroll-height, so the viewport *height* does not
// clip the image — baselines are full-component-height design exports
// (desktop 1200×863, mobile 375×1282). A viewport height is still required by
// page.setViewportSize(); INITIAL_VIEWPORT_HEIGHT is an arbitrary starting box
// the page is free to grow beyond, deliberately decoupled from the breakpoint.
const INITIAL_VIEWPORT_HEIGHT = 800;
const VIEWPORTS = [
  { id: "mobile", width: 375 },
  { id: "desktop", width: 1200 },
] as const;

// Load per-task threshold config (D-04): task default + per-story overrides.
// Override keys: "<story-id>" applies to all viewports; "<story-id>/<viewport>"
// (e.g. "layouts-footer--default/mobile") wins over the story-wide key —
// needed when ink density differs enough between breakpoints that no single
// ratio separates a perfect build's AA from a rearranged layout.
interface ThresholdsConfig {
  default: number;
  overrides: Record<string, number>;
}
const thresholdsRaw = readFileSync(join(VISUAL_DIR, "thresholds.json"), "utf8");
const thresholds: ThresholdsConfig = JSON.parse(thresholdsRaw) as ThresholdsConfig;

// Fail-closed guard — the visual sweep discovers stories from baseline dirs,
// not expected.json, so a missing manifest would let the sweep run zero diffs
// and still report pass. Assert the manifest exists so its absence FAILS.
test("expected.json is present", () => {
  expect(
    existsSync(EXPECTED_PATH),
    "tests/stories/expected.json not found — overlay the task directory first",
  ).toBe(true);
});

const STORY_IDS = readdirSync(VISUAL_DIR, { withFileTypes: true })
  .filter(
    (d) =>
      d.isDirectory() &&
      !d.name.startsWith(".") &&
      !d.name.startsWith("_") &&
      !d.name.endsWith("-snapshots"),
  )
  .map((d) => d.name)
  .sort();

// Per-story capture mode, by convention: "pages-*" stories are full-page
// design exports → "page"; atoms/molecules/layouts are natural-size crops →
// "element". An optional capture.json in the story dir overrides the default.
interface CaptureConfig {
  capture: "page" | "element";
}
function captureMode(storyId: string): "page" | "element" {
  const capturePath = join(VISUAL_DIR, storyId, "capture.json");
  if (existsSync(capturePath)) {
    const cfg = JSON.parse(readFileSync(capturePath, "utf8")) as CaptureConfig;
    return cfg.capture === "element" ? "element" : "page";
  }
  return storyId.startsWith("pages-") ? "page" : "element";
}

// Always-on current renders: toHaveScreenshot only emits artifacts on
// FAILURE, leaving a passing run with no visual evidence to inspect. Before
// every comparison, save the current render to a stable path so humans and
// agents can always view what each story renders right now:
//   test-results/current/<story-id>/<viewport>.png
const CURRENT_DIR = join(VISUAL_DIR, "..", "..", "test-results", "current");

// Fail-closed guard on capture geometry: a 0×0 baseline (corrupt/empty design
// export) or a 0×0 story root (component rendered nothing — e.g. a required
// input missing throws NG0950 and Angular mounts an empty host) must FAIL
// loudly with the real cause, not pass by diffing background against
// background or die on an opaque screenshot error downstream.
function baselineSize(storyId: string, viewportId: string): { width: number; height: number } {
  const baseline = readFileSync(join(VISUAL_DIR, storyId, `${viewportId}.png`));
  const view = new DataView(baseline.buffer, baseline.byteOffset, baseline.byteLength);
  const width = view.getUint32(16, false); // PNG IHDR width
  const height = view.getUint32(20, false); // PNG IHDR height
  if (width === 0 || height === 0) {
    throw new Error(
      `baseline tests/visual/${storyId}/${viewportId}.png is ${width}x${height} — corrupt or empty export`,
    );
  }
  return { width, height };
}
async function saveCurrentRender(
  page: import("@playwright/test").Page,
  storyId: string,
  viewportId: string,
  options: { clip?: { x: number; y: number; width: number; height: number }; fullPage?: boolean },
): Promise<void> {
  const dir = join(CURRENT_DIR, storyId);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ ...options, path: join(dir, `${viewportId}.png`) });
}

for (const storyId of STORY_IDS) {
  // Only iterate viewports whose baseline PNG exists in this story dir (VERIFY-02).
  const activeViewports = VIEWPORTS.filter((vp) =>
    existsSync(join(VISUAL_DIR, storyId, `${vp.id}.png`)),
  );

  const mode = captureMode(storyId);

  test.describe(storyId, () => {
    for (const vp of activeViewports) {
      // Threshold precedence: per-viewport override > per-story override > default.
      const maxDiffPixelRatio =
        thresholds.overrides[`${storyId}/${vp.id}`] ??
        thresholds.overrides[storyId] ??
        thresholds.default;
      test(`${vp.id} (${vp.width}px wide)`, async ({ page }, testInfo) => {
        test.setTimeout(20_000);
        // Height is the initial box only; `fullPage: true` captures full scroll height.
        await page.setViewportSize({
          width: vp.width,
          height: INITIAL_VIEWPORT_HEIGHT,
        });

        const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

        await page
          .locator("#storybook-root *, #root *")
          .first()
          .waitFor({ state: "attached", timeout: 5_000 });

        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content: `*, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }`,
        });
        await page.waitForTimeout(200);

        if (mode === "element") {
          // Element capture: screenshot a baseline-sized region anchored at
          // the OUTERMOST ELEMENT OF THE STORY TEMPLATE. Storybook Angular
          // injects its own wrapper component as the direct child of
          // #storybook-root (a display:block host that spans the viewport),
          // so the story's real root is one level deeper:
          // #storybook-root > wrapper > <template root>.
          //
          // The clip is sized from the baseline PNG's IHDR dimensions, not the
          // element's own box: if the rendered component is a pixel off in
          // size, the mismatch shows up as a graded pixel diff at the edges
          // (absorbed or flagged by maxDiffPixelRatio) instead of an opaque
          // binary "size mismatch" failure.
          const host = page
            .locator("#storybook-root > * > *, #root > * > *")
            .first();
          const box = await host.boundingBox();
          if (!box) throw new Error(`story template root not visible for ${storyId}`);
          if (box.width === 0 || box.height === 0) {
            throw new Error(
              `story template root for ${storyId} is ${box.width}x${box.height} — ` +
                `the component rendered empty (check the story's args and the browser console)`,
            );
          }
          const { width: clipW, height: clipH } = baselineSize(storyId, vp.id);
          // A non-fullPage screenshot is clamped at the viewport bottom, so a
          // clip taller than the viewport silently captures a shorter image
          // ("Expected 375x919, received 375x800"). Grow the viewport height
          // to fit the clip — height never drives layout (only width does),
          // it just sizes the capture window.
          const neededHeight = Math.ceil(box.y + clipH);
          const current = page.viewportSize();
          if (current && neededHeight > current.height) {
            await page.setViewportSize({ width: current.width, height: neededHeight });
            await page.waitForTimeout(100);
          }
          const clip = { x: box.x, y: box.y, width: clipW, height: clipH };
          await saveCurrentRender(page, storyId, vp.id, { clip });
          await expect(page).toHaveScreenshot([storyId, `${vp.id}.png`], {
            clip,
            maxDiffPixelRatio,
          });
        } else {
          baselineSize(storyId, vp.id); // same 0×0-baseline guard as element mode
          await saveCurrentRender(page, storyId, vp.id, { fullPage: true });
          await expect(page).toHaveScreenshot([storyId, `${vp.id}.png`], {
            fullPage: true,
            maxDiffPixelRatio,
          });
        }

        // toHaveScreenshot attaches expected/actual only on FAILURE, so the
        // HTML report's image-diff view (slider, side-by-side) is missing for
        // passing tests. Attach the pair on pass too — the report groups
        // attachments by the -expected/-actual suffix convention. (On failure
        // this line is never reached; Playwright attaches its own triple.)
        await testInfo.attach(`${vp.id}-expected.png`, {
          path: join(VISUAL_DIR, storyId, `${vp.id}.png`),
          contentType: "image/png",
        });
        await testInfo.attach(`${vp.id}-actual.png`, {
          path: join(CURRENT_DIR, storyId, `${vp.id}.png`),
          contentType: "image/png",
        });
      });
    }
  });
}
