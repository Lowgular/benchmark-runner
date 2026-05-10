import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const STORY_ID = process.env["BENCH_STORY_ID"];
const OUTPUT_DIR = resolve(process.env["BENCH_OUTPUT_DIR"] ?? ".bench");

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag2aaa",
  "wcag21a",
  "wcag21aa",
  "wcag21aaa",
  "wcag22aa",
  "best-practice",
];

test.describe("axe accessibility (WCAG AAA + best-practice)", () => {
  test.skip(!STORY_ID, "BENCH_STORY_ID not set");

  test("story renders with zero accessibility violations", async ({ page }) => {
    const url = `/iframe.html?id=${encodeURIComponent(STORY_ID!)}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    const results = await new AxeBuilder({ page })
      .include("#storybook-root")
      .withTags(WCAG_TAGS)
      .analyze();

    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      join(OUTPUT_DIR, "axe-result.json"),
      `${JSON.stringify(results, null, 2)}\n`,
      "utf8",
    );

    if (results.violations.length > 0) {
      const lines = results.violations.map((v) => {
        const targets = v.nodes
          .slice(0, 3)
          .map((n) => `      ${n.target.join(" ")}`)
          .join("\n");
        const more =
          v.nodes.length > 3 ? `\n      …and ${v.nodes.length - 3} more` : "";
        return `  [${v.impact ?? "unknown"}] ${v.id}\n    ${v.help}\n${targets}${more}`;
      });
      console.error(
        `\n${results.violations.length} accessibility violation(s):\n\n${lines.join("\n\n")}\n`,
      );
    }

    expect(
      results.violations,
      `expected zero WCAG AAA violations`,
    ).toEqual([]);
  });
});
