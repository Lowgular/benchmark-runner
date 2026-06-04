// Story inventory + smoke sweep.
//
// Two checks, both driven by the built Storybook at storybook-static/:
//
//   1. Inventory — every story id listed in tests/stories/expected.json
//      (overlaid by the task) must be registered in storybook-static/index.json.
//      A missing id means the story title / export name doesn't produce the
//      required id (id = kebab-case(title.replace("/", "-")) + "--" + kebab-case(exportName)).
//
//   2. Smoke — every registered story must mount in the Storybook iframe
//      without console errors, page errors, or the Storybook error overlay.
//
// Pre-requisite: `npm run build` so storybook-static/ exists (the verify:*
// npm scripts handle this). Results surface in test-results/SUMMARY.md.

import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STORIES_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(STORIES_DIR, "..", "..", "storybook-static", "index.json");
const EXPECTED_PATH = join(STORIES_DIR, "expected.json");

interface IndexEntry {
  id: string;
  type: string;
}

const registeredIds: string[] = existsSync(INDEX_PATH)
  ? (Object.values(
      (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
        entries: Record<string, IndexEntry>;
      }).entries,
    ) as IndexEntry[])
      .filter((e) => e.type === "story")
      .map((e) => e.id)
      .sort()
  : [];

const expectedIds: string[] = existsSync(EXPECTED_PATH)
  ? (JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as string[])
  : [];

test("storybook index is available", () => {
  expect(
    existsSync(INDEX_PATH),
    "storybook-static/index.json not found — run `npm run build` first",
  ).toBe(true);
});

test.describe("inventory", () => {
  for (const id of expectedIds) {
    test(`${id} is registered`, () => {
      expect(
        registeredIds,
        `Required story "${id}" is not registered in Storybook. ` +
          `Check the story title and export name — the generated id must match exactly. ` +
          `Currently registered: ${registeredIds.join(", ") || "(none)"}`,
      ).toContain(id);
    });
  }
});

test.describe("smoke", () => {
  for (const storyId of registeredIds) {
    test(`${storyId} renders without errors`, async ({ page }) => {
      test.setTimeout(15_000);

      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });

      const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      await page
        .locator("#storybook-root *, #root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      await expect(
        page.locator("body"),
        "Storybook error overlay is showing — the story threw while rendering",
      ).not.toHaveClass(/sb-show-errordisplay/);

      const rootHtml = await page
        .locator("#storybook-root")
        .innerHTML()
        .catch(() => "");
      expect(rootHtml.trim().length, "story rendered empty output").toBeGreaterThan(0);

      expect(errors, `errors while rendering:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});
