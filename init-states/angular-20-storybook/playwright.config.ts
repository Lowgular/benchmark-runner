import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /\.spec\.ts$/,
  fullyParallel: true,
  workers: "50%",
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
    // Always boot a fresh server against the just-built storybook-static/.
    // Reusing a listener from a prior loop can diff against a stale build —
    // unacceptable for an operator/agent iterating scripts back-to-back (WR-04).
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
