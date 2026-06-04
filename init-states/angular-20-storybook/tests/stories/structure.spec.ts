// Runtime DOM composition check — anti-monolith gate (VERIFY-03, D-08).
//
// For each page-level story id in tests/stories/expected.json (overlaid by the
// task at runtime), this verifier opens the story in the Storybook iframe and
// asserts that every non-page component selector declared in the manifest is
// present in the rendered DOM. This proves the agent composed the page from
// the specced atoms/molecules/layouts rather than shipping a monolith.
//
// Selectors are derived from story ids by naming convention — no static
// analysis of component source files (D-08: "the browser never lies").
//
// storyIdToSelector("atoms-image--default")          → "app-image"
// storyIdToSelector("molecules-select-field--default") → "app-select-field"
// storyIdToSelector("pages-product--default")         → "app-product"
//
// Rule: take segment before "--", strip leading level prefix
// (atoms-|molecules-|layouts-|pages-), prepend "app-".
//
// Pre-requisite: `npm run build` so storybook-static/ exists (the
// verify:structure npm script handles this). Results surface in
// test-results/verify-structure.json via the shared JSON-envelope reporter.

import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STORIES_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(STORIES_DIR, "..", "..", "storybook-static", "index.json");
const EXPECTED_PATH = join(STORIES_DIR, "expected.json");

/** Convert a story id to the Angular component selector it must produce in the DOM.
 *
 * Examples:
 *   "atoms-image--default"            → "app-image"
 *   "atoms-icon-button--default"      → "app-icon-button"
 *   "molecules-select-field--default" → "app-select-field"
 *   "pages-product--default"          → "app-product"
 */
function storyIdToSelector(id: string): string {
  const base = id.split("--")[0]!; // e.g. "atoms-image"
  const withoutLevel = base.replace(/^(atoms|molecules|layouts|pages)-/, ""); // e.g. "image"
  return `app-${withoutLevel}`; // e.g. "app-image"
}

const expectedIds: string[] = existsSync(EXPECTED_PATH)
  ? (JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as string[])
  : [];

// Page story ids are those whose base segment starts with "pages-"
const pageStoryIds = expectedIds.filter((id) => id.split("--")[0]!.startsWith("pages-"));

// Non-page ids produce the component selectors the page must contain
const componentSelectors = [
  ...new Set(
    expectedIds
      .filter((id) => !id.split("--")[0]!.startsWith("pages-"))
      .map((id) => storyIdToSelector(id)),
  ),
];

// Error guard — verify the build has been run before structure checks proceed
test("storybook index is available", () => {
  expect(
    existsSync(INDEX_PATH),
    "storybook-static/index.json not found — run `npm run build` first",
  ).toBe(true);
});

// Fail-closed guard — a missing expected.json silently empties pageStoryIds,
// disabling the anti-monolith gate (D-08) while still reporting pass. Assert
// the manifest exists so its absence FAILS rather than vacuously passes.
test("expected.json is present", () => {
  expect(
    existsSync(EXPECTED_PATH),
    "tests/stories/expected.json not found — overlay the task directory first",
  ).toBe(true);
});

test.describe("structure", () => {
  for (const pageStoryId of pageStoryIds) {
    test(`${pageStoryId} DOM composition`, async ({ page }) => {
      test.setTimeout(15_000);

      const url = `/iframe.html?id=${encodeURIComponent(pageStoryId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // Wait on the SAME root the composition assertions target so the wait
      // cannot succeed against a root the checks ignore (WR-05); a missing
      // #storybook-root render fails here rather than passing vacuously.
      await page
        .locator("#storybook-root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      for (const selector of componentSelectors) {
        await expect(
          page.locator(selector).first(),
          `Expected component ${selector} to be present in page story DOM — ` +
            `the page appears to be missing the <${selector}> element. ` +
            `Ensure the page story composes from the specced components rather than ` +
            `inlining their markup directly.`,
        ).toBeAttached();
      }
    });
  }
});
