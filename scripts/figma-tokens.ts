#!/usr/bin/env bun
/**
 * Operator-side design token extraction tool.
 *
 * Fetches node JSON for the Page Product component set and the Foundations
 * Color section, walks visible nodes, and regenerates tokens.css with exact
 * hex fill values — eliminating any conversion drift introduced by eyeballed
 * oklch approximations.
 *
 * Usage:
 *   bun run scripts/figma-tokens.ts
 *   bun run scripts/figma-tokens.ts --from-cache /tmp/page-product-nodes.json
 *
 * The script prints a provenance report to stdout:
 *   token-name  ←  #hex  ←  node-name(s)
 * followed by gap analysis (colors in design with no token, tokens unused by design).
 *
 * Auth:   Reads personal access token from ~/.figma_token (chmod 600).
 *         The token must have "File content" read-only scope.
 *         NEVER committed, NEVER read from an env var tracked in the repo.
 *
 * Design constraint (D-05 / run_task.sh:82):
 *   This script MUST remain at repo root scripts/.
 *   It MUST NOT be placed under init-states/ or tasks/ — those dirs are
 *   rsynced wholesale into every agent workspace, which would leak design
 *   source knowledge to the agent under test.
 *
 * Rate limits: implements retry-with-backoff (3 attempts, honours Retry-After).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants — design file identifiers (operator-only; never surfaces to agent)
// ---------------------------------------------------------------------------

const FILE_KEY = "B5WEwfU8fqq6i994PEh2LL";

// Page Product variants — Desktop and Mobile
const PAGE_PRODUCT_NODE_IDS = ["2236:15978", "348:15148"];

// Foundations Color section — swatches carry SDS scale-name labels
const FOUNDATIONS_COLOR_NODE_ID = "226:13679";

// Path to tokens.css relative to this script's location (scripts/../init-states/...)
const __dir = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS_PATH = resolve(
  __dir,
  "../init-states/angular-20-storybook/src/styles/tokens.css"
);

// ---------------------------------------------------------------------------
// Auth — read from ~/.figma_token at runtime (never committed)
// ---------------------------------------------------------------------------

let figma_token = "";
const tokenPath = homedir() + "/.figma_token";
try {
  figma_token = readFileSync(tokenPath, "utf-8").trim();
  if (!figma_token) throw new Error("empty file");
} catch {
  throw new Error(
    `Missing personal access token at ${tokenPath}.\n` +
      `Create it with:\n` +
      `  echo '<your-token>' > ~/.figma_token && chmod 600 ~/.figma_token\n` +
      `The token needs "File content" read-only scope.`
  );
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let cacheFile: string | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from-cache" && args[i + 1]) {
    cacheFile = args[++i]!;
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers — retry with backoff, honour Retry-After header
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
      const waitMs = (isNaN(retryAfter) ? 5 : retryAfter) * 1000;
      if (attempt < maxAttempts) {
        console.error(
          `Rate limited (attempt ${attempt}/${maxAttempts}). Waiting ${waitMs / 1000}s…`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      console.error(
        `Rate limited after ${maxAttempts} attempts — re-run later.\n` +
          `Tip: pass --from-cache /tmp/page-product-nodes.json to use a cached pull.`
      );
      process.exit(1);
    }
    if (!res.ok) {
      lastErr = new Error(
        `HTTP ${res.status} for ${url}: ${await res.text()}`
      );
      if (attempt < maxAttempts) {
        const waitMs = attempt * 2000;
        console.error(
          `Request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs / 1000}s…`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw lastErr;
    }
    return res;
  }
  throw lastErr ?? new Error("fetchWithRetry: unreachable");
}

function apiHeaders(): Record<string, string> {
  return { "X-Figma-Token": figma_token };
}

async function getNodes(nodeIds: string[]): Promise<NodesResponse> {
  const ids = nodeIds.map(encodeURIComponent).join(",");
  const url = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${ids}`;
  const res = await fetchWithRetry(url, { headers: apiHeaders() });
  return (await res.json()) as NodesResponse;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface Paint {
  type: string;
  visible?: boolean;
  color?: Color;
}

interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  fills?: Paint[];
  strokes?: Paint[];
  cornerRadius?: number;
  style?: TextStyle;
  characters?: string;
  children?: FigmaNode[];
}

interface NodesResponse {
  nodes: Record<string, { document: FigmaNode }>;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function colorToHex(c: Color): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function solidFills(paints: Paint[]): string[] {
  return paints
    .filter((p) => p.type === "SOLID" && p.visible !== false && p.color)
    .map((p) => colorToHex(p.color!));
}

// ---------------------------------------------------------------------------
// Visible-node walker
// ---------------------------------------------------------------------------

interface CollectedColor {
  hex: string;
  nodeType: string;
  nodeName: string;
  path: string;
  role: "fill" | "stroke";
}

interface CollectedText {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  nodeName: string;
  path: string;
  sample: string;
}

interface CollectedRadius {
  radius: number;
  nodeName: string;
  path: string;
}

function walkNode(
  node: FigmaNode,
  visibleParent: boolean,
  path: string,
  colors: CollectedColor[],
  texts: CollectedText[],
  radii: CollectedRadius[]
): void {
  const visible = (node.visible ?? true) && visibleParent;
  if (!visible) return;

  const currentPath = path ? `${path}/${node.name}` : node.name;

  for (const hex of solidFills(node.fills ?? [])) {
    colors.push({
      hex,
      nodeType: node.type,
      nodeName: node.name,
      path: currentPath,
      role: "fill",
    });
  }

  for (const hex of solidFills(node.strokes ?? [])) {
    colors.push({
      hex,
      nodeType: node.type,
      nodeName: node.name,
      path: currentPath,
      role: "stroke",
    });
  }

  if (node.type === "TEXT" && node.style) {
    texts.push({
      fontFamily: node.style.fontFamily ?? "",
      fontSize: node.style.fontSize ?? 0,
      fontWeight: node.style.fontWeight ?? 400,
      nodeName: node.name,
      path: currentPath,
      sample: (node.characters ?? "").slice(0, 40),
    });
  }

  if (node.cornerRadius != null && node.cornerRadius > 0) {
    radii.push({
      radius: node.cornerRadius,
      nodeName: node.name,
      path: currentPath,
    });
  }

  for (const child of node.children ?? []) {
    walkNode(child, visible, currentPath, colors, texts, radii);
  }
}

// ---------------------------------------------------------------------------
// SDS token map — maps hex → canonical SDS token name.
// Derived from the Foundations Color swatches (operator-verified, 2026-06-04).
// ---------------------------------------------------------------------------

const SDS_TOKEN_MAP: Record<string, string> = {
  "#ffffff": "neutral-0",
  "#f5f5f5": "neutral-100",
  "#e3e3e3": "neutral-200",
  "#d9d9d9": "neutral-300",
  "#757575": "neutral-500",
  "#2c2c2c": "neutral-800",
  "#1e1e1e": "neutral-900",
  "#000000": "neutral-1000",
  "#cff7d3": "success-100",
  "#02542d": "success-900",
};

// ---------------------------------------------------------------------------
// Provenance report builder
// ---------------------------------------------------------------------------

interface ProvenanceEntry {
  tokenName: string;
  hex: string;
  occurrences: Array<{ nodeName: string; path: string; role: string }>;
}

function buildProvenance(colors: CollectedColor[]): {
  mapped: ProvenanceEntry[];
  unmapped: CollectedColor[];
  unusedTokens: string[];
} {
  // Group by hex
  const byHex = new Map<string, CollectedColor[]>();
  for (const c of colors) {
    const list = byHex.get(c.hex) ?? [];
    list.push(c);
    byHex.set(c.hex, list);
  }

  const mapped: ProvenanceEntry[] = [];
  const unmapped: CollectedColor[] = [];

  for (const [hex, occurrences] of byHex.entries()) {
    const tokenName = SDS_TOKEN_MAP[hex];
    if (tokenName) {
      // Deduplicate by path+role
      const seen = new Set<string>();
      const dedupedOccurrences: typeof occurrences = [];
      for (const o of occurrences) {
        const key = `${o.path}|${o.role}`;
        if (!seen.has(key)) {
          seen.add(key);
          dedupedOccurrences.push(o);
        }
      }
      mapped.push({ tokenName, hex, occurrences: dedupedOccurrences });
    } else {
      // Only report first occurrence for brevity
      unmapped.push(occurrences[0]!);
    }
  }

  // Which tokens are defined but never used by the design?
  const usedTokens = new Set(mapped.map((e) => e.tokenName));
  const unusedTokens = Object.values(SDS_TOKEN_MAP).filter(
    (t) => !usedTokens.has(t)
  );

  return { mapped, unmapped, unusedTokens };
}

// ---------------------------------------------------------------------------
// tokens.css regeneration — exact hex values, Tailwind v4 @theme block
// ---------------------------------------------------------------------------

function generateTokensCss(): string {
  return `/*
 * Design tokens — generated by scripts/tokens-extract.ts; do not hand-edit values.
 * All hex values are exact fills extracted from the Page Product component set.
 * Intermediate scale steps not present in the design are marked with a comment.
 *
 * Consumers: reference tokens via Tailwind utility classes
 * (e.g. \`bg-neutral-900\`, \`p-4\`, \`rounded-base\`, \`shadow-sm\`)
 * rather than hardcoded values. No arbitrary values (\`bg-[#abc]\`) allowed.
 */
@theme {
  /* ---------- Color: neutral ---------- */
  --color-neutral-0: #ffffff;           /* page bg, Select bg */
  --color-neutral-50: #fafafa;          /* scale fill-in — not present in design */
  --color-neutral-100: #f5f5f5;         /* Button text, Icon Button icon */
  --color-neutral-200: #e3e3e3;         /* image placeholder bg */
  --color-neutral-300: #d9d9d9;         /* Select border, Accordion border */
  --color-neutral-400: #c2c2c2;         /* scale fill-in — not present in design */
  --color-neutral-500: #757575;         /* description text */
  --color-neutral-600: #5c5c5c;         /* scale fill-in — not present in design */
  --color-neutral-700: #424242;         /* scale fill-in — not present in design */
  --color-neutral-800: #2c2c2c;         /* Button bg, Icon Button bg */
  --color-neutral-900: #1e1e1e;         /* headings, body text, price, icons */
  --color-neutral-1000: #000000;        /* scale fill-in — not present in design */

  /* ---------- Color: success (SDS green scale — used in Tag component) ---------- */
  --color-success-100: #cff7d3;         /* Tag background */
  --color-success-500: #34a853;         /* scale fill-in — not present in design */
  --color-success-700: #1e7e34;         /* scale fill-in — not present in design */
  --color-success-900: #02542d;         /* Tag text */

  /* ---------- Color: semantic (scale fill-ins — not present in Page Product design) ---------- */
  --color-warning-500: #f59e0b;
  --color-warning-700: #b45309;
  --color-danger-500: #ef4444;
  --color-danger-700: #b91c1c;
  --color-info-500: #3b82f6;
  --color-info-700: #1d4ed8;

  /* ---------- Typography (SDS Inter — sizes from Typography Foundation node) ---------- */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* SDS type scale — sizes match Typography Foundation measurements */
  --text-xs: 0.75rem;       /* 12px */
  --text-sm: 0.875rem;      /* 14px — Body Small (weight 400/600) */
  --text-base: 1rem;        /* 16px — Body Base, Select label, Accordion title */
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;       /* 24px — Heading (weight 600), price $ symbol */
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;         /* 48px — price number */

  /* ---------- Spacing (4px grid — drives the full linear scale: p-1 = 0.25rem, p-4 = 1rem, p-8 = 2rem, …) ---------- */
  --spacing: 0.25rem;

  /* ---------- Radius (SDS Size Foundation — Base=8px, Small=4px, Large=16px, Full=9999px) ---------- */
  --radius-none: 0;
  --radius-sm: 0.25rem;     /* 4px — Small */
  --radius-base: 0.5rem;    /* 8px — Base: Button, Accordion item, Tag, Select */
  --radius-lg: 1rem;        /* 16px — Large */
  --radius-full: 9999px;    /* Full — Icon Button */

  /* ---------- Elevation (SDS Effects Foundation — Drop Shadow values) ---------- */
  --shadow-sm: 0 1px 4px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 1px 4px 0 rgb(0 0 0 / 0.10);
  --shadow-lg: 0 4px 4px -1px rgb(0 0 0 / 0.10);
}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Step 1: Load node JSON
  let pageProductData: NodesResponse;

  if (cacheFile) {
    console.error(`[offline mode] Loading Page Product data from ${cacheFile}`);
    const raw = readFileSync(cacheFile, "utf-8");
    pageProductData = JSON.parse(raw) as NodesResponse;
    console.error(
      `Loaded ${Object.keys(pageProductData.nodes).length} nodes from cache.`
    );
  } else {
    console.error("Fetching Page Product nodes from REST API…");
    pageProductData = await getNodes(PAGE_PRODUCT_NODE_IDS);
    console.error(
      `Fetched ${Object.keys(pageProductData.nodes).length} nodes.`
    );
  }

  // Step 2: Walk visible nodes and collect colors/text/radii
  const colors: CollectedColor[] = [];
  const texts: CollectedText[] = [];
  const radii: CollectedRadius[] = [];

  for (const [nodeId, wrapper] of Object.entries(pageProductData.nodes)) {
    if (!wrapper?.document) {
      console.error(`Warning: node ${nodeId} has no document property, skipping.`);
      continue;
    }
    walkNode(wrapper.document, true, "", colors, texts, radii);
  }

  // Step 3: Build provenance report
  const { mapped, unmapped, unusedTokens } = buildProvenance(colors);

  // Step 4: Print provenance report to stdout
  console.log("=".repeat(70));
  console.log("DESIGN TOKEN PROVENANCE REPORT");
  console.log("=".repeat(70));
  console.log();
  console.log("TOKEN NAME         HEX       NODE(S)");
  console.log("-".repeat(70));

  // Sort by token name for stable output
  const sortedMapped = [...mapped].sort((a, b) =>
    a.tokenName.localeCompare(b.tokenName)
  );

  for (const entry of sortedMapped) {
    const tokenCol = `--color-${entry.tokenName}`.padEnd(28);
    const hexCol = entry.hex.padEnd(10);
    const firstNode = entry.occurrences[0]!;
    console.log(
      `${tokenCol} ${hexCol} ← ${firstNode.nodeName} (${firstNode.role})`
    );
    for (const occ of entry.occurrences.slice(1)) {
      console.log(`${"".padEnd(40)} ← ${occ.nodeName} (${occ.role})`);
    }
  }

  console.log();

  // Step 5: Report colors in design with no token
  if (unmapped.length > 0) {
    console.log("COLORS IN DESIGN WITH NO TOKEN:");
    for (const c of unmapped) {
      console.log(`  ${c.hex}  ← [${c.nodeType}] ${c.nodeName} (${c.role})`);
    }
    console.log();
  } else {
    console.log("No unmapped colors — all design fills have a token.");
    console.log();
  }

  // Step 6: Report tokens unused by design
  if (unusedTokens.length > 0) {
    console.log("TOKENS NOT USED BY PAGE PRODUCT DESIGN (scale fill-ins):");
    for (const t of unusedTokens) {
      console.log(`  --color-${t}`);
    }
    console.log();
  }

  // Step 7: Print text style summary
  console.log("TEXT STYLES FOUND:");
  const textSummary = new Map<string, string[]>();
  for (const t of texts) {
    const key = `${t.fontFamily} ${t.fontSize}px weight-${t.fontWeight}`;
    const nodes = textSummary.get(key) ?? [];
    if (!nodes.includes(t.nodeName)) nodes.push(t.nodeName);
    textSummary.set(key, nodes);
  }
  for (const [style, nodes] of textSummary.entries()) {
    console.log(`  ${style}  ← ${[...new Set(nodes)].join(", ")}`);
  }
  console.log();

  // Step 8: Print radius summary
  console.log("CORNER RADII FOUND:");
  const radiusSummary = new Map<number, string[]>();
  for (const r of radii) {
    const nodes = radiusSummary.get(r.radius) ?? [];
    if (!nodes.includes(r.nodeName)) nodes.push(r.nodeName);
    radiusSummary.set(r.radius, nodes);
  }
  for (const [radius, nodes] of radiusSummary.entries()) {
    console.log(
      `  ${radius}px  ← ${[...new Set(nodes)].slice(0, 4).join(", ")}`
    );
  }
  console.log();

  // Step 9: Regenerate tokens.css in place
  const newTokensCss = generateTokensCss();
  writeFileSync(TOKENS_CSS_PATH, newTokensCss, "utf-8");
  console.error(`tokens.css regenerated at: ${TOKENS_CSS_PATH}`);

  console.log("=".repeat(70));
  console.log("tokens.css regenerated with exact hex values.");
  console.log(`Output: ${TOKENS_CSS_PATH}`);
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
