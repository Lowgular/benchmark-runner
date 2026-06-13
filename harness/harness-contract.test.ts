/**
 * Harness contract test — enforces the plugin boundary documented in
 * .planning/codebase/ARCHITECTURE.md.
 *
 * Contract (v2 — evolved for pipeline-mode harnesses):
 *   - Harnesses NEVER write files. Run artifacts (agent.jsonl, RESPONSE.md,
 *     summary.json, pipeline handoffs) are written by framework.ts — a harness
 *     yields `{t:"artifact"}` events instead of touching the filesystem.
 *   - Harnesses MAY read workspace state (pipeline.json, sub-agent AGENTS.md,
 *     contract files) and MAY spawn gate commands (`verify:element`) — that is
 *     how deterministic pipeline control flow works.
 *   - No CLI parsing, no process.env (declare requiredEnv/optionalEnv, read
 *     params.secrets), no console logging — yield Message events.
 *   - Every import from framework.ts must be type-only (shared runtime code
 *     lives in dedicated modules: models.ts, agent-file.ts, summary.ts).
 *
 * The rules apply to EVERY .ts file under harness/<name>/src/, not just the
 * entry — hiding a write in a sibling module is still a violation.
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
  .map((d) => {
    const srcDir = join(HERE, d.name, "src");
    const files = readdirSync(srcDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => join(srcDir, f));
    return { name: d.name, entry: join(srcDir, "index.ts"), files };
  });

const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bwriteFileSync?\b/, reason: "file writes belong to framework.ts — yield {t:\"artifact\"} events" },
  { pattern: /\bappendFileSync?\b/, reason: "file writes belong to framework.ts — yield {t:\"artifact\"} events" },
  { pattern: /\bBun\.write\b/, reason: "file writes belong to framework.ts — yield {t:\"artifact\"} events" },
  { pattern: /\bcreateWriteStream\b/, reason: "file writes belong to framework.ts — yield {t:\"artifact\"} events" },
  { pattern: /\bmkdirSync?\b/, reason: "file writes belong to framework.ts" },
  { pattern: /\brmSync\b|\brmdirSync\b|\bunlinkSync\b/, reason: "file writes belong to framework.ts" },
  { pattern: /\brenameSync\b|\bcopyFileSync\b|\bcpSync\b/, reason: "file writes belong to framework.ts" },
  { pattern: /\bprocess\.argv\b/, reason: "CLI parsing belongs to framework.ts" },
  { pattern: /\bprocess\.env\b/, reason: "env access belongs to framework.ts — declare requiredEnv/optionalEnv and read params.secrets" },
  { pattern: /\bconsole\.(log|error|warn|info)\b/, reason: "logging belongs to framework.ts — yield Message events instead" },
];

describe("harness plugin contract", () => {
  test("at least one harness plugin exists", () => {
    expect(harnessEntries.length).toBeGreaterThan(0);
  });

  for (const { name, entry, files } of harnessEntries) {
    describe(name, () => {
      for (const file of files) {
        const source = readFileSync(file, "utf8");
        const rel = file.slice(HERE.length + 1);

        for (const { pattern, reason } of FORBIDDEN) {
          test(`${rel} does not match ${pattern} (${reason})`, () => {
            expect(source).not.toMatch(pattern);
          });
        }

        test(`${rel} only imports types from framework.ts`, () => {
          const frameworkImports = source.match(/import\s+[^;]*from\s+["']\.\.\/\.\.\/framework\.ts["']/g) ?? [];
          for (const imp of frameworkImports) {
            expect(imp).toMatch(/import\s+type\s/);
          }
        });
      }

      test("entry exports the run() generator", () => {
        const source = readFileSync(entry, "utf8");
        expect(source).toMatch(/export\s+(async\s+)?function\*?\s+run\b/);
      });
    });
  }
});
