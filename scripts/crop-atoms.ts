#!/usr/bin/env bun
/**
 * Atom baseline derivation — crops atom-level ground truth from the committed
 * product-page desktop baseline PNG.
 *
 * Provenance chain: Figma REST export (scripts/figma-export.ts, committed)
 * → tasks/vrt/product-page/tests/visual/pages-product--default/desktop.png
 * (committed) → this script (committed) → per-atom baselines. Every atom
 * baseline is derived from committed inputs by committed code — no hand-cropping.
 *
 * Detection: each atom is found by scanning for its signature token color
 * (exact hex match for the bounding box; anti-aliased edge pixels fall inside
 * the detected box). The crop rectangle is the exact contiguous color block,
 * so the atom's CSS box contract (width × height in its task spec) is pixel-
 * faithful to the design render.
 *
 * Usage: bun run scripts/crop-atoms.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
// pngjs ships with the init-state workspace (VRT dependency) — reuse it.
import { PNG } from "../init-states/angular-20-storybook/node_modules/pngjs/lib/png.js";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const PAGE_BASELINE = join(
  ROOT,
  "tasks/vrt/product-page/tests/visual/pages-product--default/desktop.png",
);

const png = PNG.sync.read(readFileSync(PAGE_BASELINE));
const { width: W, height: H, data } = png as {
  width: number;
  height: number;
  data: Buffer;
};

function px(x: number, y: number): [number, number, number] {
  const i = (y * W + x) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

function isColor(x: number, y: number, [r, g, b]: number[]): boolean {
  const [pr, pg, pb] = px(x, y);
  return pr === r && pg === g && pb === b;
}

/** Exact bounding box of `color` within a search region, counting only pixels
 * that belong to a horizontal run of >= minRun consecutive matches. Text
 * anti-aliasing can produce isolated pixels that hit a token color exactly;
 * a real component block always has long solid runs. */
function findRect(
  color: [number, number, number],
  region: { x0: number; y0: number; x1: number; y1: number },
  minRun = 12,
): { x: number; y: number; w: number; h: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = region.y0; y < region.y1; y++) {
    let runStart = -1;
    for (let x = region.x0; x <= region.x1; x++) {
      const match = x < region.x1 && isColor(x, y, color);
      if (match && runStart < 0) runStart = x;
      if (!match && runStart >= 0) {
        if (x - runStart >= minRun) {
          if (runStart < minX) minX = runStart;
          if (x - 1 > maxX) maxX = x - 1;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        runStart = -1;
      }
    }
  }
  if (maxX < 0) throw new Error(`color ${color.join(",")} not found in region`);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function crop(rect: { x: number; y: number; w: number; h: number }): PNG {
  const out = new PNG({ width: rect.w, height: rect.h });
  PNG.bitblt(png, out, rect.x, rect.y, rect.w, rect.h, 0, 0);
  return out;
}

function save(out: PNG, rel: string): void {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, PNG.sync.write(out));
}

// ---------------------------------------------------------------------------
// Token signature colors (src/styles/tokens.css)
// ---------------------------------------------------------------------------
const NEUTRAL_800: [number, number, number] = [0x2c, 0x2c, 0x2c]; // Button bg, Icon Button bg
const NEUTRAL_200: [number, number, number] = [0xe3, 0xe3, 0xe3]; // Image placeholder bg
const SUCCESS_100: [number, number, number] = [0xcf, 0xf7, 0xd3]; // Tag bg

// ---------------------------------------------------------------------------
// Atom detection manifest. Search regions split the page into left column
// (image + icon button, x<600) and right column (everything else, x>600)
// so the two neutral-800 blocks (Icon Button vs Button) cannot collide.
// ---------------------------------------------------------------------------
const results: Record<string, { x: number; y: number; w: number; h: number }> = {};

// Button — neutral-800 bar in the right column
const button = findRect(NEUTRAL_800, { x0: 600, y0: 0, x1: W, y1: H });
save(crop(button), "tasks/vrt/atom-button/tests/visual/atoms-button--default/desktop.png");
results["atom-button"] = button;

// Icon Button — neutral-800 circle in the left column. minRun=2: a 36px
// circle's pole rows have short runs, and the left column contains no other
// neutral-800 content that could pollute the bounding box.
const iconButton = findRect(NEUTRAL_800, { x0: 0, y0: 0, x1: 600, y1: H }, 2);
save(
  crop(iconButton),
  "tasks/vrt/atom-icon-button/tests/visual/atoms-icon-button--default/desktop.png",
);
results["atom-icon-button"] = iconButton;

// Tag — success-100 badge in the right column
const tag = findRect(SUCCESS_100, { x0: 600, y0: 0, x1: W, y1: H });
save(crop(tag), "tasks/vrt/atom-tag/tests/visual/atoms-tag--default/desktop.png");
results["atom-tag"] = tag;

// Image — neutral-200 placeholder in the left column. The page overlays the
// Icon Button on its top-left; the standalone Image atom has no overlay, so
// paint the icon-button area (plus 2px anti-alias margin) back to neutral-200.
const image = findRect(NEUTRAL_200, { x0: 0, y0: 0, x1: 600, y1: H });
const imageCrop = crop(image);
for (let y = iconButton.y - 2; y < iconButton.y + iconButton.h + 2; y++) {
  for (let x = iconButton.x - 2; x < iconButton.x + iconButton.w + 2; x++) {
    const cx = x - image.x;
    const cy = y - image.y;
    if (cx < 0 || cy < 0 || cx >= image.w || cy >= image.h) continue;
    const i = (cy * image.w + cx) * 4;
    imageCrop.data[i] = NEUTRAL_200[0];
    imageCrop.data[i + 1] = NEUTRAL_200[1];
    imageCrop.data[i + 2] = NEUTRAL_200[2];
    imageCrop.data[i + 3] = 255;
  }
}
save(imageCrop, "tasks/vrt/atom-image/tests/visual/atoms-image--default/desktop.png");
results["atom-image"] = image;

// ---------------------------------------------------------------------------
// Report — these exact dimensions go verbatim into each atom's task spec.
// ---------------------------------------------------------------------------
for (const [name, r] of Object.entries(results)) {
  console.log(`${name}: x=${r.x} y=${r.y} ${r.w}x${r.h}`);
}
