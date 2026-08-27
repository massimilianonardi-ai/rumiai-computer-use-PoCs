#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3c-file-picker-accept-result-diagnostic-s01"
export EXPECTED_PRODUCT_SHA="2be349b1fdf2a6ea08ee893be423942d926a2c0b"
export TEST_SOURCE_SHA="53f0de348a4547b6bfda531d82eaeaa7d971dff1"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-accept-result-diagnostic.js"
export PHYSICAL_TEST_ID="physical:phase9b3c-file-picker-accept-result-diagnostic"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
