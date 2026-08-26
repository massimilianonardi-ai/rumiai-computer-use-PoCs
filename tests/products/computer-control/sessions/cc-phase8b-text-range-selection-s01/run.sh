#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8b-text-range-selection-s01"
export EXPECTED_PRODUCT_SHA="778c39e3358295ba18b0bbfd0705858f6902a15d"
export TEST_SOURCE_SHA="a6bf06a467dfc9bbd4fd9289cd112aef99a342b6"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-range-selection.js"
export PHYSICAL_TEST_ID="physical:phase8b-text-range-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
