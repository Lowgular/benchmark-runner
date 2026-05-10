// Visual regression sweep for one Storybook story across three viewports.
//
// Pre-requisite: `npm run build` so storybook-static/ exists. The Playwright
// webServer config will boot http-server against it.
//
// Baselines live at <BENCH_BASELINES_DIR>/{mobile,tablet,desktop}.png
// (defaults to tools/verify/__baselines__/ when BENCH_BASELINES_DIR is unset).
//
// First run with `npm run verify:update` to seed baselines; subsequent runs
// compare with `npm run verify`. Failed diffs surface in the Playwright HTML
// report with the built-in slider.

import { expect, test } from "@playwright/test";

const STORY_ID = process.env["BENCH_STORY_ID"];

const VIEWPORTS = [
  { id: "mobile", width: 375, height: 812 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1280, height: 800 },
] as const;

test.describe("visual regression", () => {
  test.skip(!STORY_ID, "BENCH_STORY_ID not set");

  for (const vp of VIEWPORTS) {
    test(`${vp.id} (${vp.width}×${vp.height})`, async ({ page }) => {
      test.setTimeout(20_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const url = `/iframe.html?id=${encodeURIComponent(STORY_ID!)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // Wait for Storybook to mount the story.
      await page
        .locator("#storybook-root *, #root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      // Wait for fonts and kill animations so screenshots are reproducible.
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

      await expect(page).toHaveScreenshot(`${vp.id}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
