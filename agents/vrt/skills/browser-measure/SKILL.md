---
name: browser-measure
description: Measure your rendered components in a live headless browser instead of guessing from pixel diffs. Use when a visual diff tells you WHERE the mismatch is but not WHY — one browser_evaluate that returns computed styles and bounding boxes beats three guess-and-verify cycles. Also use to inspect what Storybook actually mounted into the DOM.
---

# Measure in a live browser

You have Playwright browser tools (`browser_navigate`, `browser_evaluate`, `browser_resize`, …). Use them as a **measurement instrument** when iterating on visual failures.

## Serve your build

```bash
npx http-server storybook-static -p 6007 --silent & echo $! > .measure-server.pid
```

Port **6007** — NEVER 6006 (the verifier's `webServer` owns it and refuses to reuse an existing server; binding it breaks every verify script).

NEVER use a broad `pkill -f http-server` — it matches processes outside your workspace, including your own runtime's process tree (this has crashed an entire run). Kill ONLY your own server, by saved PID:

```bash
kill "$(cat .measure-server.pid)" 2>/dev/null || true
```

`storybook-static/` is a build output: rebuild (`npm run build` or any verify script) before re-measuring, or you'll measure stale code.

## Navigate to a story

```
browser_navigate → http://localhost:6007/iframe.html?id=<story-id>&viewMode=story
```

`browser_resize` sets the viewport width for breakpoint checks (375 mobile / 1200 desktop).

## Measure, don't screenshot

The VRT artifacts already give you pixels (`test-results/<...>-actual.png`, `-diff.png`). What the browser adds is **computed values** — prefer `browser_evaluate` over `browser_snapshot`/`browser_take_screenshot`:

```js
// Component box: is my rendered size exactly the spec's W×H?
const el = document.querySelector('#storybook-root > * > *');
const r = el.getBoundingClientRect();
({ w: r.width, h: r.height, x: r.x, y: r.y })
```

```js
// Why is it 4px taller? Interrogate the style pipeline:
const el = document.querySelector('app-button');
const cs = getComputedStyle(el.firstElementChild);
({ lineHeight: cs.lineHeight, padding: cs.padding, fontSize: cs.fontSize,
   fontWeight: cs.fontWeight, borderRadius: cs.borderRadius, display: cs.display })
```

```js
// What did Storybook actually mount? (wrapper structure, your template root)
document.querySelector('#storybook-root').outerHTML.slice(0, 800)
```

## Typical loop

1. Verify script fails → read the diff PNG → form a hypothesis ("text sits ~3px too low").
2. `browser_evaluate` the relevant computed styles → confirm the actual numbers.
3. Fix the one property that's wrong. Rebuild. Re-verify.

## Cleanup

Kill your http-server by its saved PID (`kill "$(cat .measure-server.pid)"`) if anything behaves oddly, and never bind 6006. Never `pkill` by pattern.
