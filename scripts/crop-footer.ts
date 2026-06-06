#!/usr/bin/env bun
/**
 * Footer piece baseline derivation — crops atom/molecule ground truth from the
 * committed footer desktop baseline PNG.
 *
 * Provenance chain: Figma browser export (scripts/figma-browser.ts, committed)
 * → tasks/vrt/footer/tests/visual/layouts-footer--default/desktop.png
 * (committed) → this script (committed) → per-piece baselines. Every baseline
 * is derived from committed inputs by committed code — no hand-cropping.
 *
 * All footer pieces are glyph/text ink on a white ground, so detection is the
 * ink-bbox (luminance < 240) within a search region that contains only the
 * target's ink — same detector as atom-price in crop-atoms.ts.
 *
 * Usage: bun run scripts/crop-footer.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
// pngjs ships with the init-state workspace (VRT dependency) — reuse it.
import { PNG } from "../init-states/angular-20-storybook/node_modules/pngjs/lib/png.js";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const FOOTER_BASELINE = join(
  ROOT,
  "tasks/vrt/footer/tests/visual/layouts-footer--default/desktop.png",
);

const png = PNG.sync.read(readFileSync(FOOTER_BASELINE));
const { width: W, height: H, data } = png as {
  width: number;
  height: number;
  data: Buffer;
};

function px(x: number, y: number): [number, number, number] {
  const i = (y * W + x) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

/** Ink bounding box — all sub-white pixels (glyph ink + anti-aliasing) inside
 * the search region. The region must contain only the target's ink. */
function findInkRect(region: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}): { x: number; y: number; w: number; h: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x++) {
      const [r, g, b] = px(x, y);
      if (r < 240 || g < 240 || b < 240) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("no ink found in region");
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
// Search regions (footer desktop is 1200x468; top border line spans y=0..1,
// so all regions start below y=2). Left block: logo + social icon row.
// First link column ("Use cases") starts at x≈310.
// ---------------------------------------------------------------------------
const results: Record<string, { x: number; y: number; w: number; h: number }> = {};

// Logo — stroke glyph at the top-left.
const logo = findInkRect({ x0: 10, y0: 5, x1: 90, y1: 80 });
save(crop(logo), "tasks/vrt/footer/tests/visual/atoms-logo--default/desktop.png");
results["atoms-logo"] = logo;

// Social Icon Link — first icon of the social row (X glyph).
const socialIcon = findInkRect({ x0: 10, y0: 82, x1: 68, y1: 125 });
save(
  crop(socialIcon),
  "tasks/vrt/footer/tests/visual/atoms-social-icon-link--default/desktop.png",
);
results["atoms-social-icon-link"] = socialIcon;

// Social Links — the whole 4-icon row.
const socialLinks = findInkRect({ x0: 10, y0: 82, x1: 200, y1: 125 });
save(
  crop(socialLinks),
  "tasks/vrt/footer/tests/visual/molecules-social-links--default/desktop.png",
);
results["molecules-social-links"] = socialLinks;

// Link — first link of the first column ("UI design"); region sits between the
// "Use cases" heading above and "UX design" below.
const link = findInkRect({ x0: 300, y0: 75, x1: 480, y1: 110 });
save(crop(link), "tasks/vrt/footer/tests/visual/atoms-link--default/desktop.png");
results["atoms-link"] = link;

// Link Column — heading + 7 links of the first column ("Use cases").
const linkColumn = findInkRect({ x0: 300, y0: 5, x1: 480, y1: 320 });
save(
  crop(linkColumn),
  "tasks/vrt/footer/tests/visual/molecules-link-column--default/desktop.png",
);
results["molecules-link-column"] = linkColumn;

// ---------------------------------------------------------------------------
// Report — these exact dimensions go verbatim into the task spec.
// ---------------------------------------------------------------------------
for (const [name, r] of Object.entries(results)) {
  console.log(`${name}: x=${r.x} y=${r.y} ${r.w}x${r.h}`);
}
