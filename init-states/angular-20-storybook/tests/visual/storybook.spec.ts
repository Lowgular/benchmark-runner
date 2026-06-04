// Visual regression sweep for every Storybook story across three viewports.
//
// Stories are discovered by listing subdirectories under tests/visual/ —
// each subfolder name is treated as a Storybook story id (the value of
// `?id=` in the Storybook iframe URL). The folder holds the 3 baselines:
//
//   tests/visual/<story-id>/
//     ├── mobile.png
//     ├── tablet.png
//     └── desktop.png
//
// Pre-requisite: `npm run build` so storybook-static/ exists. The Playwright
// webServer config will boot http-server against it. Failed diffs surface in
// test-results/SUMMARY.md and the HTML report at test-results/html/.

import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VISUAL_DIR = dirname(fileURLToPath(import.meta.url));

const VIEWPORTS = [
  { id: "mobile", width: 375, height: 812 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1280, height: 800 },
] as const;

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
  test.describe(storyId, () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.id} (${vp.width}×${vp.height})`, async ({ page }) => {
        test.setTimeout(20_000);
        await page.setViewportSize({ width: vp.width, height: vp.height });

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
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  });
}
