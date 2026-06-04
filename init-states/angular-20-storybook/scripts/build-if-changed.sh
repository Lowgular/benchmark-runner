#!/usr/bin/env bash
# Smart-skip Storybook rebuild: rebuilds only when src/ has changed since storybook-static/ was produced.
# Satisfies WR-04: never diffs against a stale build — any src change forces a rebuild.
# Usage: bash scripts/build-if-changed.sh  (called from package.json verify/validate scripts)
set -euo pipefail

MARKER="storybook-static/.last-build-marker"

needs_rebuild() {
  # No output dir → always build
  [ ! -d "storybook-static" ] && return 0
  # No marker → conservative: build
  [ ! -f "$MARKER" ] && return 0
  # Any src file newer than the marker → rebuild
  find src -newer "$MARKER" -type f | grep -q . && return 0
  return 1
}

if needs_rebuild; then
  echo "[build-if-changed] src/ changed — rebuilding storybook-static/" >&2
  npm run build
  touch "$MARKER"
else
  echo "[build-if-changed] storybook-static/ is up to date — skipping rebuild" >&2
fi
