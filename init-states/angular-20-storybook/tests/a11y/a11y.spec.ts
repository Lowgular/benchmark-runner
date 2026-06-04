// Accessibility validator — VALID-01.
//
// For every story id in tests/stories/expected.json, opens the Storybook
// iframe in a real Playwright Chromium context (so colour-contrast rules
// work correctly — axe requires a real renderer, not JSDOM), then runs
// @axe-core/playwright against #storybook-root with WCAG 2.0 A/AA and
// WCAG 2.1 AA tags.
//
// Pass/fail contract (per PITFALLS.md Pitfall 4):
//   - results.violations  → test FAILS  (genuinely wrong; report selector-level details)
//   - results.incomplete  → advisory log only (axe cannot confirm — not a test failure)
//
// Failure message includes: violation id, impact, description, helpUrl, and
// the CSS selector(s) of the failing node(s) — giving the agent actionable
// remediation hints at selector level (VALID-01 requirement).
//
// Pre-requisite: `npm run build` so storybook-static/ exists (the
// validate:a11y npm script handles this). JSON envelope written by
// json-summary-reporter.ts via VERIFY_SCRIPT=validate:a11y.

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const A11Y_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(A11Y_DIR, "..", "stories", "expected.json");

const expectedIds: string[] = existsSync(EXPECTED_PATH)
  ? (JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as string[])
  : [];

test("expected.json is present", () => {
  expect(
    existsSync(EXPECTED_PATH),
    "tests/stories/expected.json not found — overlay the task directory first",
  ).toBe(true);
});

test.describe("a11y", () => {
  for (const storyId of expectedIds) {
    test(`${storyId} has no WCAG violations`, async ({ page }) => {
      test.setTimeout(20_000);

      const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // Wait for the Angular component to mount inside the story root.
      // Wait on the SAME root the assertions target (#storybook-root) so the
      // wait cannot succeed against a root the checks ignore (WR-05).
      await page
        .locator("#storybook-root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      const results = await new AxeBuilder({ page })
        .include("#storybook-root")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();

      // Log incomplete items as advisory — not a test failure (PITFALLS.md § Pitfall 4).
      if (results.incomplete.length > 0) {
        console.log(
          `[a11y advisory] ${storyId} — ${results.incomplete.length} incomplete rule(s) need manual review:`,
          results.incomplete.map((v) => v.id).join(", "),
        );
      }

      // Fail only on confirmed violations; include selector-level remediation hints.
      const violationSummary = results.violations
        .map((v) => {
          const selectors = v.nodes
            .map((n) => n.target.join(" "))
            .join("; ");
          return (
            `  [${v.impact ?? "unknown"}] ${v.id}: ${v.description}\n` +
            `    selectors: ${selectors || "(none)"}\n` +
            `    help: ${v.helpUrl}`
          );
        })
        .join("\n");

      expect(
        results.violations,
        `WCAG violations in "${storyId}":\n${violationSummary}`,
      ).toEqual([]);
    });
  }
});
