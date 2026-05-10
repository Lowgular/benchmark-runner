/**
 * Token-discipline scanner.
 *
 * Looks at the agent's component files and flags shortcuts that bypass
 * the design system:
 *   - arbitrary Tailwind values         e.g. `bg-[#1a73e8]`, `p-[13px]`
 *   - inline hex / rgb / hsl literals    e.g. `color: #abc`, `oklch(...)` outside tokens.css
 *   - inline `style=` / `[style]=` / `[ngStyle]=` attributes
 *
 * Exits with 0 always; the caller decides what to do with the violations.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

export type TokenViolationKind =
  | "arbitrary-tailwind"
  | "inline-hex"
  | "inline-color-fn"
  | "inline-style-attr"
  | "inline-style-binding";

export interface TokenViolation {
  file: string;
  line: number;
  column: number;
  kind: TokenViolationKind;
  match: string;
}

const TARGET_EXTENSIONS = new Set([".ts", ".html", ".css", ".scss"]);

const ARBITRARY_TW = /\b(?:bg|text|border|outline|ring|fill|stroke|p[trblxy]?|m[trblxy]?|w|h|min-w|min-h|max-w|max-h|gap|space-[xy]|rounded(?:-[trbl]{1,2})?|shadow|leading|tracking|opacity|z|inset|top|right|bottom|left|grid-cols|grid-rows|col-span|row-span|order|basis|flex|aspect)-\[[^\]]+\]/g;
const INLINE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_COLOR_FN = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\s*\(/g;
const INLINE_STYLE_ATTR = /\sstyle\s*=\s*["'][^"']*["']/g;
const INLINE_STYLE_BINDING = /\[(?:style|ngStyle)(?:\.[a-zA-Z-]+)?\]\s*=/g;

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (TARGET_EXTENSIONS.has(extname(entry))) files.push(full);
  }
  return files;
}

function findMatches(
  src: string,
  re: RegExp,
  kind: TokenViolationKind,
  file: string,
): TokenViolation[] {
  re.lastIndex = 0;
  const out: TokenViolation[] = [];
  for (const m of src.matchAll(re)) {
    const idx = m.index ?? 0;
    const before = src.slice(0, idx);
    const line = before.split("\n").length;
    const col = idx - before.lastIndexOf("\n");
    out.push({ file, line, column: col, kind, match: m[0] });
  }
  return out;
}

function isTokenAuthorityFile(rel: string): boolean {
  return rel.endsWith("tokens.css") || rel.endsWith("global.css");
}

export function scanTokens(
  agentRootAbs: string,
  cwd: string,
): TokenViolation[] {
  const files = walk(agentRootAbs);
  const violations: TokenViolation[] = [];
  for (const file of files) {
    const rel = relative(cwd, file).replaceAll("\\", "/");
    if (isTokenAuthorityFile(rel)) continue;
    const src = readFileSync(file, "utf8");
    violations.push(...findMatches(src, ARBITRARY_TW, "arbitrary-tailwind", rel));
    if (extname(file) !== ".css" && extname(file) !== ".scss") {
      violations.push(...findMatches(src, INLINE_HEX, "inline-hex", rel));
      violations.push(...findMatches(src, INLINE_COLOR_FN, "inline-color-fn", rel));
    }
    if (extname(file) === ".html" || extname(file) === ".ts") {
      violations.push(...findMatches(src, INLINE_STYLE_ATTR, "inline-style-attr", rel));
      violations.push(
        ...findMatches(src, INLINE_STYLE_BINDING, "inline-style-binding", rel),
      );
    }
  }
  return violations;
}

if (import.meta.main) {
  const agentRoot = resolve(process.env["BENCH_AGENT_DIR"] ?? "src/lib");
  const violations = scanTokens(agentRoot, process.cwd());
  console.log(JSON.stringify({ count: violations.length, violations }, null, 2));
}
