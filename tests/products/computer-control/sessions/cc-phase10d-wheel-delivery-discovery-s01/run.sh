#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10d-wheel-delivery-discovery-s01"
export EXPECTED_PRODUCT_SHA="9cb037f688a82f733de520062b0adb30c0994a8b"
export TEST_SOURCE_SHA="e9eb48cdc821bd2f3614e0d99756df10b9511aae"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10d-wheel-delivery-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10d-wheel-delivery-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
