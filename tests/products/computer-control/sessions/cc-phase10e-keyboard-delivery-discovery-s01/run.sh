#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10e-keyboard-delivery-discovery-s01"
export EXPECTED_PRODUCT_SHA="0f4d2c0378b12df50ed192721dded97edff9f72e"
export TEST_SOURCE_SHA="fd462455a0b989b459d63d5a3d5833420a191d2f"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10e-keyboard-delivery-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10e-keyboard-delivery-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
