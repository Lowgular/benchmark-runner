// Scaffold integrity verifier — the executable form of "don't touch the
// scaffold". Compares every protected file against the sha256 snapshot taken
// at workspace setup (scripts/integrity-snapshot.mjs, run from postinstall —
// before the agent starts). Any drift fails with the exact file path.
//
// Joins `npm run verify` automatically (playwright discovers this spec); it
// is skipped by story-filtered `verify:element -- -g` runs (its test title
// matches no story id), so it costs nothing in the per-element loop.

import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT = join(ROOT, "tests", "integrity", "hashes.json");

test("scaffold is unmodified (read-only contract)", () => {
  expect(
    existsSync(SNAPSHOT),
    "tests/integrity/hashes.json missing — workspace setup did not run the integrity snapshot",
  ).toBe(true);

  const hashes = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<string, string>;
  const violations: string[] = [];
  for (const [rel, expected] of Object.entries(hashes)) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      violations.push(`DELETED: ${rel}`);
      continue;
    }
    const actual = createHash("sha256").update(readFileSync(abs)).digest("hex");
    if (actual !== expected) violations.push(`MODIFIED: ${rel}`);
  }

  expect(
    violations,
    `Read-only scaffold files changed — revert them (they are part of the task contract):\n` +
      violations.map((v) => `  ${v}`).join("\n"),
  ).toEqual([]);
});
