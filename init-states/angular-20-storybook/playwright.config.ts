import { defineConfig } from "@playwright/test";

const BASE_URL = process.env["BENCH_BASE_URL"] ?? "http://127.0.0.1:6006";
const REUSE_SERVER = process.env["BENCH_REUSE_SERVER"] === "1";
const BASELINES_DIR = process.env["BENCH_BASELINES_DIR"];

export default defineConfig({
  testDir: "./tools",
  testMatch: /\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: ".bench/playwright-report" }],
    ["json", { outputFile: ".bench/playwright-report.json" }],
  ],
  // Where toHaveScreenshot() reads/writes baselines.
  // When BENCH_BASELINES_DIR is set (per-task baselines from `tasks/vrt/...`),
  // each snapshot lives at <BASELINES_DIR>/<arg><ext>. Otherwise we fall back
  // to a colocated __baselines__ directory next to the spec.
  snapshotPathTemplate: BASELINES_DIR
    ? `${BASELINES_DIR}/{arg}{ext}`
    : "{testFileDir}/__baselines__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: REUSE_SERVER
    ? undefined
    : {
        command: "npx http-server storybook-static -p 6006 -s -c-1",
        url: "http://127.0.0.1:6006",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
