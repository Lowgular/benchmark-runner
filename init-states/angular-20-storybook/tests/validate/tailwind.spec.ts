// Tailwind discipline validator — VALID-03.
//
// For every story id in tests/stories/expected.json, opens the Storybook
// iframe, then checks the rendered DOM under #storybook-root for three
// categories of violation that indicate an agent is gaming the VRT pixel
// diff rather than following the token system (PITFALLS.md § Pitfall 2):
//
//   1. Arbitrary Tailwind values  (e.g. bg-[#abc], p-[13px], text-[1.1rem])
//      Detected by: collecting every class token across all elements and
//      matching the arbitraryPattern regex.
//
//   2. Inline style attributes    (style="..." / [style]="...")
//      Detected by: querying for [style] attribute presence under the root.
//
//   3. Oversized markup           (node-count gaming-prevention heuristic)
//      An agent that wraps every piece of text in deeply nested divs to
//      hit pixel targets inflates node count without semantic benefit.
//      Threshold: 400 total element nodes under #storybook-root.
//      This is a generous guard — a well-decomposed Page Product story
//      (image, heading, tag, price, description, 2 selects, button, accordion)
//      should produce well under 200 nodes. 400 is intentionally loose to
//      avoid false positives on complex page stories; tune downward after
//      measuring real agent output.
//
// Failure messages name the offending class strings and/or selectors so
// the agent knows exactly which element to fix.
//
// Pre-requisite: `npm run build` so storybook-static/ exists. JSON envelope
// written by json-summary-reporter.ts via VERIFY_SCRIPT=validate:tailwind.

import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATE_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(VALIDATE_DIR, "..", "stories", "expected.json");

const expectedIds: string[] = existsSync(EXPECTED_PATH)
  ? (JSON.parse(readFileSync(EXPECTED_PATH, "utf8")) as string[])
  : [];

// Matches any Tailwind arbitrary-value bracket expression.
// Covers the most common patterns that bypass the token system:
//   bg-[#abc123]   → hex colors
//   p-[13px]       → raw pixel lengths
//   text-[1.1rem]  → raw rem values
//   w-[50%]        → raw percentages
//   mt-[2.5em]     → raw em values
// The pattern intentionally captures the bracket-wrapped segment so the
// offending class token is included verbatim in the violation message.
const arbitraryPattern =
  /\[(?:#[0-9a-fA-F]+|[0-9]+(?:\.[0-9]+)?(?:px|rem|em|%|vw|vh)[^\]]*|\d+\/\d+[^\]]*)\]/;

// Gaming-prevention DOM node budget (elements only, not text nodes).
// 400 is deliberately generous for a page-level story; well-structured
// product page should produce ≤200 nodes. Tune after first agent submissions.
const NODE_COUNT_BUDGET = 400;

test("expected.json is present", () => {
  expect(
    existsSync(EXPECTED_PATH),
    "tests/stories/expected.json not found — overlay the task directory first",
  ).toBe(true);
});

test.describe("Tailwind discipline", () => {
  for (const storyId of expectedIds) {
    test(`${storyId} passes token-compliance checks`, async ({ page }) => {
      test.setTimeout(20_000);

      const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });

      // Wait for the Angular component to mount inside the story root.
      await page
        .locator("#storybook-root *, #root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      const violations: string[] = [];

      // ── Check 1: arbitrary Tailwind values ──────────────────────────────
      // Collect every class attribute token across all descendant elements.
      const classLists: string[] = await page
        .locator("#storybook-root *")
        .evaluateAll(
          (els: Element[]) => els.map((el) => el.getAttribute("class") ?? ""),
        );

      const arbitraryTokens = classLists.flatMap((cls) =>
        cls
          .split(/\s+/)
          .filter((token) => token.length > 0 && arbitraryPattern.test(token)),
      );

      if (arbitraryTokens.length > 0) {
        violations.push(
          `[arbitrary-values] Found ${arbitraryTokens.length} arbitrary Tailwind value(s) — use tokens.css utilities only:\n` +
            arbitraryTokens.map((t) => `    ${t}`).join("\n"),
        );
      }

      // ── Check 2: inline style attributes ────────────────────────────────
      // Any style= attribute on an element under the story root is a ban.
      const inlineStyleSelectors: string[] = await page
        .locator("#storybook-root *[style]")
        .evaluateAll(
          (els: Element[]) =>
            els.map((el) => {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : "";
              const cls = el.className
                ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).join(".")}`
                : "";
              return `${tag}${id}${cls}`;
            }),
        );

      if (inlineStyleSelectors.length > 0) {
        violations.push(
          `[inline-styles] Found ${inlineStyleSelectors.length} element(s) with inline style= attribute — remove and use token utilities:\n` +
            inlineStyleSelectors.map((s) => `    ${s}`).join("\n"),
        );
      }

      // ── Check 3: oversized markup (anti-gaming node-count heuristic) ────
      // Count total element nodes under #storybook-root (not text nodes).
      const nodeCount: number = await page
        .locator("#storybook-root *")
        .count();

      if (nodeCount > NODE_COUNT_BUDGET) {
        violations.push(
          `[oversized-markup] DOM node count ${nodeCount} exceeds budget ${NODE_COUNT_BUDGET} ` +
            `— excessive nesting may indicate div-soup or pixel-gaming; ` +
            `refactor to use semantic elements and the atomic component hierarchy.`,
        );
      }

      expect(
        violations,
        `Token-compliance violations in "${storyId}":\n${violations.join("\n")}`,
      ).toEqual([]);
    });
  }
});
