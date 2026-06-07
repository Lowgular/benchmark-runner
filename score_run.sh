#!/usr/bin/env bash
# Usage: ./score_run.sh <run-dir>
# Example: ./score_run.sh runs/vrt/footer/4de47945-b1f2-4271-97d5-9e534b8b1e3c
#
# Pass-2: official scoring, decoupled from the orchestrator and the agent.
# Runs the workspace's own verifier suite (`npm run verify` — defined by the
# init-state, not by this script) against whatever the agent left behind.
# The resulting test-results/ (SUMMARY.md + per-script JSON envelopes +
# current renders + HTML report) is the run's score record, independent of
# anything the agent reported about itself.
#
# Works on any run dir, including historical ones — re-scoring after a
# verifier fix is a normal operation (copy the updated verifier in first).
set -euo pipefail

RUN_DIR="${1:?usage: score_run.sh <run-dir>}"
RUN_DIR="$(cd "$RUN_DIR" && pwd)"

if [ ! -f "$RUN_DIR/package.json" ]; then
  echo "Not a run workspace (no package.json): $RUN_DIR" >&2
  exit 1
fi

cd "$RUN_DIR"

echo "[score] running full verifier suite in ${RUN_DIR}..."
if npm run verify; then
  echo "[score] ALL GATES GREEN"
else
  echo "[score] gates failed — see $RUN_DIR/test-results/SUMMARY.md"
fi
echo "[score] report: npx playwright show-report $RUN_DIR/test-results/html"
