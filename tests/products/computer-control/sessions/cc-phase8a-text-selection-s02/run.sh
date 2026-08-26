#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8a-text-selection-s02"
export EXPECTED_PRODUCT_SHA="0ad6baf7e82d2cde3d5fdbe4da57a884b93c5be5"
export TEST_SOURCE_SHA="79af56caf2a121b70d8ed29545b766beaf93bbcd"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-selection.js"
export PHYSICAL_TEST_ID="physical:phase8a-text-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
