/**
 * Harness contract test — enforces the plugin boundary documented in
 * .planning/codebase/ARCHITECTURE.md:
 *
 *   Harness plugins must NOT do file I/O, CLI parsing, or logging —
 *   only yield Message events. framework.ts owns all file output
 *   (agent.jsonl, RESPONSE.md, summary.json).
 *
 * Run with: bun test harness/
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const harnessEntries = readdirSync(HERE, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(HERE, d.name, "src", "index.ts")))
  .map((d) => ({ name: d.name, file: join(HERE, d.name, "src", "index.ts") }));

const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /from\s+["'](node:)?fs["']/, reason: "file I/O belongs to framework.ts" },
  { pattern: /from\s+["'](node:)?fs\/promises["']/, reason: "file I/O belongs to framework.ts" },
  { pattern: /\bBun\.write\b/, reason: "file I/O belongs to framework.ts" },
  { pattern: /\bcreateWriteStream\b/, reason: "file I/O belongs to framework.ts" },
  { pattern: /\bwriteFileSync?\b/, reason: "file I/O belongs to framework.ts" },
  { pattern: /\bappendFileSync?\b/, reason: "file I/O belongs to framework.ts" },
  { pattern: /\bprocess\.argv\b/, reason: "CLI parsing belongs to framework.ts" },
  { pattern: /\bconsole\.(log|error|warn|info)\b/, reason: "logging belongs to framework.ts — yield Message events instead" },
];

describe("harness plugin contract", () => {
  test("at least one harness plugin exists", () => {
    expect(harnessEntries.length).toBeGreaterThan(0);
  });

  for (const { name, file } of harnessEntries) {
    describe(name, () => {
      const source = readFileSync(file, "utf8");

      for (const { pattern, reason } of FORBIDDEN) {
        test(`does not match ${pattern} (${reason})`, () => {
          expect(source).not.toMatch(pattern);
        });
      }

      test("exports the run() generator and only imports types from framework.ts", () => {
        expect(source).toMatch(/export\s+(async\s+)?function\*?\s+run\b/);
        // Every ../../framework.ts import must be type-only (the contract types).
        const frameworkImports = source.match(/import\s+[^;]*from\s+["']\.\.\/\.\.\/framework\.ts["']/g) ?? [];
        for (const imp of frameworkImports) {
          expect(imp).toMatch(/import\s+type\s/);
        }
      });
    });
  }
});
