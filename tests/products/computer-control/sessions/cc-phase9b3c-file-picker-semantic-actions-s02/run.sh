#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3c-file-picker-semantic-actions-s02"
export EXPECTED_PRODUCT_SHA="2be349b1fdf2a6ea08ee893be423942d926a2c0b"
export TEST_SOURCE_SHA="50f63d43dec87c6efc2d3af8c30e96c1a3f69386"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-semantic-actions.js"
export PHYSICAL_TEST_ID="physical:phase9b3c-file-picker-semantic-actions"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
