import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["./vrt-summary-reporter.ts"],
    ["./json-summary-reporter.ts"],
  ],
  // Baselines live at tests/visual/<story-id>/<viewport>.png.
  // The spec passes `${storyId}/${vp.id}.png` as the snapshot name.
  snapshotPathTemplate: "tests/visual/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:6006",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npx http-server storybook-static -p 6006 -s -c-1",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
