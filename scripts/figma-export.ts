#!/usr/bin/env bun
/**
 * Operator-side Figma REST API export tool.
 *
 * Exports the locked SDS Page Product component set from the Figma REST API
 * to baseline PNGs for the product-page benchmark unit.
 *
 * Usage:  bun run scripts/figma-export.ts
 *
 * Auth:   Reads personal access token from ~/.figma_token (chmod 600).
 *         The token must have "File content" read-only scope.
 *         NEVER committed, NEVER read from an env var tracked in the repo.
 *
 * Design constraint (D-05 / run_task.sh:82):
 *   This script MUST remain at repo root scripts/.
 *   It MUST NOT be placed under init-states/ or tasks/ — those dirs are
 *   rsynced wholesale into every agent workspace, which would leak Figma
 *   access/knowledge to the agent.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Token — read from ~/.figma_token at runtime (never committed)
// ---------------------------------------------------------------------------

const tokenPath = homedir() + "/.figma_token";
let figma_token: string;
try {
  figma_token = readFileSync(tokenPath, "utf-8").trim();
  if (!figma_token) throw new Error("empty file");
} catch {
  throw new Error(
    `Missing Figma personal access token at ${tokenPath}.\n` +
      `Create it with:\n` +
      `  echo '<your-token>' > ~/.figma_token\n` +
      `  chmod 600 ~/.figma_token\n` +
      `The token needs "File content" read-only scope from:\n` +
      `  https://www.figma.com/settings → Personal access tokens`
  );
}

// ---------------------------------------------------------------------------
// Export manifest — SDS Page Product component set (file B5WEwfU8fqq6i994PEh2LL)
// Checkpoint amendment 2026-06-04: node ids per Platform=Desktop / Platform=Mobile
// ---------------------------------------------------------------------------

const FILE_KEY = "B5WEwfU8fqq6i994PEh2LL";

const EXPORTS: Array<{
  nodeId: string;
  out: string;
  expectWidth: number;
  label: string;
}> = [
  {
    nodeId: "2236:15978",
    out: "tasks/vrt/product-page/tests/visual/pages-product--default/desktop.png",
    expectWidth: 1200,
    label: "Page Product — Platform=Desktop",
  },
  {
    nodeId: "348:15148",
    out: "tasks/vrt/product-page/tests/visual/pages-product--default/mobile.png",
    expectWidth: 375,
    label: "Page Product — Platform=Mobile",
  },
];

// ---------------------------------------------------------------------------
// PNG IHDR width reader — bytes 16-19 of a PNG file are the IHDR width (BE)
// ---------------------------------------------------------------------------

function readPngWidth(bytes: Uint8Array): number {
  // PNG signature: 8 bytes; IHDR chunk: 4 (length) + 4 (type) + 4 (width) ...
  // Width starts at offset 16
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(16, false /* big-endian */);
}

function readPngHeight(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(20, false /* big-endian */);
}

// ---------------------------------------------------------------------------
// PNG metadata stripper — Figma embeds a "Software: Figma" text chunk in its
// exports. D-05 requires that no Figma reference reaches the agent workspace
// (verify: `! grep -rqi figma init-states/ tasks/`), so drop all ancillary
// text chunks (tEXt/iTXt/zTXt) before writing. Pixel data is untouched.
// ---------------------------------------------------------------------------

const STRIPPED_CHUNKS = new Set(["tEXt", "iTXt", "zTXt"]);

function stripPngTextChunks(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.slice(0, 8)]; // PNG signature
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const chunkEnd = offset + 12 + length; // len + type + data + CRC
    if (!STRIPPED_CHUNKS.has(type)) {
      parts.push(bytes.slice(offset, chunkEnd));
    }
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main export loop
// ---------------------------------------------------------------------------

for (const exp of EXPORTS) {
  const encodedId = encodeURIComponent(exp.nodeId); // "2236:15978" → "2236%3A15978"

  // Step 1: Get the signed S3 URL from Figma images API
  const imagesUrl = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodedId}&format=png&scale=1`;
  const imagesRes = await fetch(imagesUrl, {
    headers: { "X-Figma-Token": figma_token },
  });

  if (!imagesRes.ok) {
    const body = await imagesRes.text();
    throw new Error(
      `Figma images API error for node ${exp.nodeId}: HTTP ${imagesRes.status}\n${body}`
    );
  }

  const imagesJson = (await imagesRes.json()) as {
    images?: Record<string, string | null>;
    err?: string;
  };

  if (imagesJson.err) {
    throw new Error(
      `Figma images API returned error for node ${exp.nodeId}: ${imagesJson.err}`
    );
  }

  const s3Url = imagesJson.images?.[exp.nodeId];
  if (!s3Url) {
    throw new Error(
      `Figma images API did not return a URL for node ${exp.nodeId}. ` +
        `Response: ${JSON.stringify(imagesJson)}`
    );
  }

  // Step 2: Fetch the PNG from S3
  const pngRes = await fetch(s3Url);
  if (!pngRes.ok) {
    throw new Error(
      `Failed to download PNG for node ${exp.nodeId}: HTTP ${pngRes.status}`
    );
  }

  const pngBytes = new Uint8Array(await pngRes.arrayBuffer());

  // Step 3: Verify it is actually a PNG
  const signature = String.fromCharCode(...pngBytes.slice(1, 4));
  if (signature !== "PNG") {
    throw new Error(
      `Downloaded bytes for node ${exp.nodeId} are not a valid PNG (got header: ${signature})`
    );
  }

  // Step 4: Assert pixel width matches expectation
  const actualWidth = readPngWidth(pngBytes);
  if (actualWidth !== exp.expectWidth) {
    throw new Error(
      `Width assertion failed for ${exp.label} (node ${exp.nodeId}):\n` +
        `  Expected: ${exp.expectWidth}px\n` +
        `  Got:      ${actualWidth}px\n` +
        `Check that the node id is correct and scale=1 is being used.`
    );
  }

  const actualHeight = readPngHeight(pngBytes);

  // Step 5: Strip text metadata (Figma software marker — D-05) and write to disk
  const cleanBytes = stripPngTextChunks(pngBytes);
  mkdirSync(dirname(exp.out), { recursive: true });
  writeFileSync(exp.out, cleanBytes);

  console.log(`✓ ${exp.out}  (${actualWidth}×${actualHeight})`);
}

console.log(`\nExport complete. ${EXPORTS.length} baseline PNGs written.`);
