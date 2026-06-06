// Token-binding validator — makes the task spec's token table machine-checked.
//
// The task overlays tests/validate/expected-tokens.json: per story id, a flat
// map of GENERAL css property → design-token name (or array of names):
//
//   {
//     "atoms-link--default": { "color": "neutral-900" },
//     "layouts-footer--default": {
//       "color": "neutral-900", "background": "neutral-0", "border": "neutral-300"
//     }
//   }
//
// The keys mirror how a design tool describes a node (text fill / fill /
// stroke), not the agent's implementation: WHAT, not HOW. For each declared
// property this verifier opens the story and collects every rendered
// occurrence in the #storybook-root subtree:
//
//   color      — computed `color` of every visible element with a direct,
//                non-whitespace text node
//   background — every visible element's computed `background-color` that is
//                not fully transparent
//   border     — every border side with style ≠ none and width > 0
//
// and asserts the set of occurrence values ⊆ the declared token value(s),
// resolved from the live tokens.css custom properties (computed styles are
// exact — no anti-aliasing slack, unlike the pixel diff). A declared property
// with ZERO occurrences also fails: a claimed border that never renders is a
// spec violation too.
//
// Stories not listed in the manifest are not checked; a task that ships no
// manifest skips this validator (reported in the envelope, not failed —
// pre-manifest tasks stay green).
//
// Pre-requisite: `npm run build` so storybook-static/ exists. JSON envelope
// written by json-summary-reporter.ts via VERIFY_SCRIPT=validate:tokens.

import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATE_DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(VALIDATE_DIR, "expected-tokens.json");

type TokenClaim = string | string[];
type StoryClaims = Record<string, TokenClaim>; // property → token(s)
type Manifest = Record<string, StoryClaims>; // story id → claims

const SUPPORTED_PROPERTIES = ["color", "background", "border"] as const;
type Property = (typeof SUPPORTED_PROPERTIES)[number];

const manifest: Manifest = existsSync(MANIFEST_PATH)
  ? (JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest)
  : {};

const storyIds = Object.keys(manifest);

test("token manifest status", () => {
  // Informational: a task without a manifest skips token validation. New
  // tasks are expected to ship one (see /ui-spec); this line makes the
  // skip visible in the envelope rather than silently green.
  console.log(
    storyIds.length === 0
      ? "no tests/validate/expected-tokens.json — token validation skipped"
      : `token manifest covers ${storyIds.length} stor${storyIds.length === 1 ? "y" : "ies"}`,
  );
  expect(true).toBe(true);
});

/** One rendered occurrence of a checked property: where + computed value. */
type Occurrence = { where: string; value: string };

test.describe("token bindings", () => {
  for (const storyId of storyIds) {
    test(`${storyId} uses the specced design tokens`, async ({ page }) => {
      test.setTimeout(20_000);

      const claims = manifest[storyId]!;
      for (const property of Object.keys(claims)) {
        expect(
          SUPPORTED_PROPERTIES.includes(property as Property),
          `Unknown property "${property}" in expected-tokens.json for "${storyId}" — ` +
            `supported: ${SUPPORTED_PROPERTIES.join(", ")}`,
        ).toBe(true);
      }

      const url = `/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 });
      await page
        .locator("#storybook-root *")
        .first()
        .waitFor({ state: "attached", timeout: 5_000 });

      // Resolve each claimed token to its computed rgb value via a probe
      // element styled with the live custom property from tokens.css.
      const tokenNames = [...new Set(Object.values(claims).flat())];
      const resolved: Record<string, string> = await page.evaluate((names: string[]) => {
        const out: Record<string, string> = {};
        const probe = document.createElement("div");
        document.body.appendChild(probe);
        for (const name of names) {
          const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(`--color-${name}`)
            .trim();
          if (!raw) {
            out[name] = ""; // token not defined in tokens.css
            continue;
          }
          probe.style.color = `var(--color-${name})`;
          out[name] = getComputedStyle(probe).color;
        }
        probe.remove();
        return out;
      }, tokenNames);

      for (const [name, value] of Object.entries(resolved)) {
        expect(
          value,
          `Token "--color-${name}" (claimed in expected-tokens.json) is not defined in tokens.css`,
        ).not.toBe("");
      }

      // Collect every rendered occurrence of each supported property.
      const occurrences: Record<Property, Occurrence[]> = await page.evaluate(() => {
        const isTransparent = (v: string) => v === "rgba(0, 0, 0, 0)" || v === "transparent";
        const label = (el: Element) => {
          const tag = el.tagName.toLowerCase();
          const cls = el.getAttribute("class");
          return cls ? `${tag}.${cls.trim().split(/\s+/).slice(0, 2).join(".")}` : tag;
        };
        const out: Record<string, { where: string; value: string }[]> = {
          color: [],
          background: [],
          border: [],
        };
        const root = document.querySelector("#storybook-root");
        if (!root) return out as never;
        for (const el of root.querySelectorAll("*")) {
          if (el.getClientRects().length === 0) continue; // not rendered
          const cs = getComputedStyle(el);
          const hasDirectText = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
          );
          if (hasDirectText) out.color!.push({ where: label(el), value: cs.color });
          if (!isTransparent(cs.backgroundColor))
            out.background!.push({ where: label(el), value: cs.backgroundColor });
          for (const side of ["top", "right", "bottom", "left"]) {
            if (
              cs.getPropertyValue(`border-${side}-style`) !== "none" &&
              parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0
            ) {
              out.border!.push({
                where: `${label(el)} (border-${side})`,
                value: cs.getPropertyValue(`border-${side}-color`),
              });
            }
          }
        }
        return out as never;
      });

      const violations: string[] = [];
      for (const [property, claim] of Object.entries(claims) as [Property, TokenClaim][]) {
        const allowedNames = Array.isArray(claim) ? claim : [claim];
        const allowedValues = allowedNames.map((n) => resolved[n]!);
        const found = occurrences[property];

        if (found.length === 0) {
          violations.push(
            `[${property}] declared as ${allowedNames.join("/")} but NO rendered occurrence found — ` +
              `the specced ${property} is missing from the story`,
          );
          continue;
        }
        for (const occ of found) {
          if (!allowedValues.includes(occ.value)) {
            violations.push(
              `[${property}] ${occ.where} computes ${occ.value} — expected token ` +
                allowedNames.map((n) => `${n} (${resolved[n]})`).join(" or "),
            );
          }
        }
      }

      expect(
        violations,
        `Token-binding violations in "${storyId}":\n${violations.map((v) => `  ${v}`).join("\n")}`,
      ).toEqual([]);
    });
  }
});
