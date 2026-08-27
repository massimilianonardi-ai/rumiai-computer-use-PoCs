#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3a-file-picker-observation-s01"
export EXPECTED_PRODUCT_SHA="c26552046ae0cc18b76ab33d6a24af98b0e68cde"
export TEST_SOURCE_SHA="4ffbe2c0790d0e9ba4fc5019634f3a5c7cc0bc64"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-observation.js"
export PHYSICAL_TEST_ID="physical:phase9b3a-file-picker-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
