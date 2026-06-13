// Scaffold integrity snapshot — makes the "don't touch the scaffold" rule
// executable instead of prose.
//
// Runs from `postinstall` (i.e. during workspace setup, BEFORE the agent
// starts) and records a sha256 per protected file into
// tests/integrity/hashes.json. The companion verifier
// (tests/integrity/integrity.spec.ts) re-hashes the same files and fails on
// any drift — accidental edits to read-only files surface as a named test
// failure instead of mysterious behavior. (Adversarial tampering is
// additionally re-checked at scoring time outside the workspace.)
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "tests", "integrity", "hashes.json");

// Everything the agent must not modify. Directories are hashed recursively.
const PROTECTED = [
  "package.json",
  "package-lock.json",
  "angular.json",
  "postcss.config.json",
  "playwright.config.ts",
  "vrt-summary-reporter.ts",
  "json-summary-reporter.ts",
  "eslint.config.js",
  "stylelint.config.js",
  ".htmlvalidate.json",
  "tsconfig.json",
  "tsconfig.app.json",
  ".storybook",
  "scripts",
  "tests",
  "src/styles/tokens.css",
  "src/styles/global.css",
];

function* walk(abs) {
  const st = statSync(abs);
  if (st.isDirectory()) {
    for (const entry of readdirSync(abs).sort()) yield* walk(join(abs, entry));
  } else {
    yield abs;
  }
}

const hashes = {};
for (const rel of PROTECTED) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const key = relative(ROOT, file);
    if (key === join("tests", "integrity", "hashes.json")) continue; // the snapshot itself
    hashes[key] = createHash("sha256").update(readFileSync(file)).digest("hex");
  }
}

mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, `${JSON.stringify(hashes, null, 2)}\n`);
console.log(`[integrity] snapshot: ${Object.keys(hashes).length} protected files`);
