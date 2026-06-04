// Visual regression sweep for every Storybook story across two breakpoints.
//
// Stories are discovered by listing subdirectories under tests/visual/ —
// each subfolder name is treated as a Storybook story id (the value of
// `?id=` in the Storybook iframe URL). The folder holds the baselines:
//
//   tests/visual/<story-id>/
//     ├── mobile.png    (375px — required for page/composition stories)
//     └── desktop.png   (1200px — required for page/composition stories)
//
// A story dir that ships only mobile.png is diffed only at mobile — atoms and
// molecules can ship fewer than both breakpoints (VERIFY-02). Only the
// viewports whose <viewport>.png file exists in the story dir are tested.
//
// Per-story thresholds are loaded from thresholds.json: a task-level "default"
// and optional per-story "overrides" (D-04). The playwright.config global
// maxDiffPixelRatio is the final fallback.
//
// Pre-requisite: `npm run build` so storybook-static/ exists. The Playwright
// webServer config will boot http-server against it. Failed diffs surface in
// test-results/SUMMARY.md and the HTML report at test-results/html/.

import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VISUAL_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(VISUAL_DIR, "..", "stories", "expected.json");

// Two breakpoints per D-02: mobile 375 + desktop 1200. Tablet (768) dropped.
// Only `width` drives layout. Captures use `fullPage: true` (see below), which
// records the entire document scroll-height, so the viewport *height* does not
// clip the image — baselines are full-component-height Figma exports
// (desktop 1200×863, mobile 375×1282). A viewport height is still required by
// page.setViewportSize(); INITIAL_VIEWPORT_HEIGHT is an arbitrary starting box
// the page is free to grow beyond, deliberately decoupled from the breakpoint.
const INITIAL_VIEWPORT_HEIGHT = 800;
const VIEWPORTS = [
  { id: "mobile", width: 375 },
  { id: "desktop", width: 1200 },
] as const;

// Load per-task threshold config (D-04): task default + per-story overrides.
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

for (const storyId of STORY_IDS) {
  // Only iterate viewports whose baseline PNG exists in this story dir (VERIFY-02).
  const activeViewports = VIEWPORTS.filter((vp) =>
    existsSync(join(VISUAL_DIR, storyId, `${vp.id}.png`)),
  );

  // Per-story threshold: override if present, else task default (D-04).
  const maxDiffPixelRatio = thresholds.overrides[storyId] ?? thresholds.default;

  test.describe(storyId, () => {
    for (const vp of activeViewports) {
      test(`${vp.id} (${vp.width}px wide)`, async ({ page }) => {
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

        await expect(page).toHaveScreenshot([storyId, `${vp.id}.png`], {
          fullPage: true,
          maxDiffPixelRatio,
        });
      });
    }
  });
}
