#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3c-file-picker-semantic-actions-s01"
export EXPECTED_PRODUCT_SHA="3cedb57d35663f74d0598b6c83645c973cdc6810"
export TEST_SOURCE_SHA="f3e0a6960ac46b7c554fae73d9849245311fcea6"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-semantic-actions.js"
export PHYSICAL_TEST_ID="physical:phase9b3c-file-picker-semantic-actions"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
