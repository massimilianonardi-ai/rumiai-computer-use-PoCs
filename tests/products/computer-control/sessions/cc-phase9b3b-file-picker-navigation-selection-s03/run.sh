#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3b-file-picker-navigation-selection-s03"
export EXPECTED_PRODUCT_SHA="16e4f1b427170b0e5c729a10629990d48ee71daf"
export TEST_SOURCE_SHA="18efb29278c95e036ce21c89603b8a33d9e5614b"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-navigation-selection.js"
export PHYSICAL_TEST_ID="physical:phase9b3b-file-picker-navigation-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
