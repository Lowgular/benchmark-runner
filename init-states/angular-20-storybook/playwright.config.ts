import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tools/verify",
  testMatch: /vrt\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: ".bench/playwright-vrt.json" }], ["list"]],
  use: {
    baseURL: process.env["BENCH_BASE_URL"] ?? "http://localhost:6006",
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    },
  ],
});
