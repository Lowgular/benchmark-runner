#!/usr/bin/env bun
/**
 * Token-table renderer — keeps task spec markdown in sync with the token
 * contract JSON.
 *
 * For every task that ships tests/validate/expected-tokens.json, this script
 * rewrites the block between
 *
 *   <!-- token-contract:begin -->
 *   <!-- token-contract:end -->
 *
 * in tasks/vrt/<task>/tasks/<task>.md with a markdown table rendered from the
 * JSON (story → property → token → value → Tailwind utility). The JSON is the
 * source of truth (it is what `validate:tokens` enforces); the markdown table
 * is a derived artifact — same provenance discipline as the baselines.
 *
 * Token values are resolved from the init-state's tokens.css so the table
 * shows the concrete hex each token carries.
 *
 * Usage: bun run scripts/render-token-tables.ts
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const TASKS_DIR = join(ROOT, "tasks", "vrt");
const TOKENS_CSS = join(ROOT, "init-states", "angular-20-storybook", "src", "styles", "tokens.css");

const BEGIN = "<!-- token-contract:begin -->";
const END = "<!-- token-contract:end -->";

// --color-<name>: <value>;  → { name: value }
const tokenValues: Record<string, string> = {};
for (const m of readFileSync(TOKENS_CSS, "utf8").matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
  tokenValues[m[1]!] = m[2]!.trim();
}

const UTILITY_PREFIX: Record<string, string> = {
  color: "text",
  background: "bg",
  border: "border",
};

function renderTable(manifest: Record<string, Record<string, string | string[]>>): string {
  const rows: string[] = [
    "| Story | Property | Token | Value | Tailwind utility |",
    "|---|---|---|---|---|",
  ];
  for (const [storyId, claims] of Object.entries(manifest)) {
    for (const [property, claim] of Object.entries(claims)) {
      for (const token of Array.isArray(claim) ? claim : [claim]) {
        const value = tokenValues[token];
        if (!value) throw new Error(`token "${token}" (in ${storyId}) not found in tokens.css`);
        const prefix = UTILITY_PREFIX[property] ?? property;
        rows.push(`| \`${storyId}\` | ${property} | \`${token}\` | \`${value}\` | \`${prefix}-${token}\` |`);
      }
    }
  }
  return rows.join("\n");
}

let updated = 0;
for (const task of readdirSync(TASKS_DIR)) {
  const manifestPath = join(TASKS_DIR, task, "tests", "validate", "expected-tokens.json");
  const specPath = join(TASKS_DIR, task, "tasks", `${task}.md`);
  if (!existsSync(manifestPath) || !existsSync(specPath)) continue;

  const spec = readFileSync(specPath, "utf8");
  const beginIdx = spec.indexOf(BEGIN);
  const endIdx = spec.indexOf(END);
  if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx) {
    throw new Error(`${task}: spec has a token manifest but no ${BEGIN}…${END} block in ${specPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const block =
    `${BEGIN}\n` +
    `<!-- generated from tests/validate/expected-tokens.json by scripts/render-token-tables.ts — do not hand-edit -->\n` +
    `${renderTable(manifest)}\n${END}`;
  const next = spec.slice(0, beginIdx) + block + spec.slice(endIdx + END.length);
  if (next !== spec) {
    writeFileSync(specPath, next);
    updated++;
    console.log(`rendered: ${specPath}`);
  } else {
    console.log(`up to date: ${specPath}`);
  }
}
console.log(`${updated} spec(s) updated`);
