// Semantic HTML validator — VALID-02.
//
// For every story id in tests/stories/expected.json, navigates to the
// Storybook iframe, extracts the innerHTML of #storybook-root, and runs
// html-validate (already installed) with DOM-quality rules:
//
//   - no-inline-style       : no style= attributes on any element
//   - require-heading-level-one : exactly one <h1> per page story (only
//                             applied to stories whose id begins with "pages-")
//   - label                 : every <input>/<select>/<textarea> has an
//                             associated <label> or aria-labelledby
//   - button-type           : every <button> carries an explicit type=
//   - element-permitted-content : no div-soup (elements nesting against spec)
//
// Failure message lists ruleId + message per error so the agent can locate
// and fix each issue (VALID-02 requirement).
//
// Pre-requisite: `npm run build` so storybook-static/ exists. JSON envelope
// written by json-summary-reporter.ts via VERIFY_SCRIPT=validate:semantic.

import { expect, test } from "@playwright/test";
import { HtmlValidate } from "html-validate";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATE_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(VALIDATE_DIR, "..", "stories", "expected.json");

const expectedIds: string[] = existsSync(EXPECTED_PATH)
  ? (JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as string[])
  : [];

// Shared rules applied to every story level.
const BASE_RULES: Record<string, string | [string, ...unknown[]]> = {
  "no-inline-style": "error",   // no style= attributes (VALID-02 + Pitfall 2 anti-gaming)
  "label": "error",             // every input/select/textarea must be associated with a label
  "button-type": "error",       // every <button> must carry an explicit type attribute
  "element-permitted-content": "error", // catch div-soup (invalid nesting per HTML spec)
  // Disable rules that produce irrelevant noise on extracted story fragments:
  "require-sri": "off",
  "no-missing-references": "off",
};

// Page-story rules: require exactly one H1 per page-level story.
const PAGE_RULES: Record<string, string | [string, ...unknown[]]> = {
  ...BASE_RULES,
  "require-heading-level-one": "error",
};

test("expected.json is present", () => {
  expect(
    existsSync(EXPECTED_PATH),
    "tests/stories/expected.json not found — overlay the task directory first",
  ).toBe(true);
});

test.describe("semantic HTML", () => {
  for (const storyId of expectedIds) {
    test(`${storyId} passes semantic HTML rules`, async ({ page }) => {
      test.setTimeout(20_000);

      const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // Wait for the Angular component to mount inside the story root.
      await page
        .locator("#storybook-root *, #root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      // Extract the story's rendered markup.
      const html = await page.locator("#storybook-root").innerHTML();

      // Page-level stories must have exactly one H1; atom/molecule fragments
      // do not (VALID-02: "single h1 on page stories").
      const isPageStory = storyId.startsWith("pages-");
      const rules = isPageStory ? PAGE_RULES : BASE_RULES;

      const htmlvalidate = new HtmlValidate({ rules });
      const result = await htmlvalidate.validateString(html);

      const errorSummary = result.results
        .flatMap((r) => r.messages)
        .filter((m) => m.severity >= 2) // error-level only (severity 2 = error, 1 = warning)
        .map((m) => `  ${m.ruleId}: ${m.message} (line ${m.line}:${m.column})`)
        .join("\n");

      expect(
        result.valid,
        `Semantic HTML violations in "${storyId}":\n${errorSummary || "(details unavailable)"}`,
      ).toBe(true);
    });
  }
});
