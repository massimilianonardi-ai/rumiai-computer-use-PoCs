#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3b-file-picker-selection-expansion-s01"
export EXPECTED_PRODUCT_SHA="805ec5126f991bd6a19945bfda5d0fc2778ae221"
export TEST_SOURCE_SHA="5e9fb88809af10c07bcf9f109d8d1e51ff92994a"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-selection-expansion.js"
export PHYSICAL_TEST_ID="physical:phase9b3b-file-picker-selection-expansion"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
