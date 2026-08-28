#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10b-pointer-delivery-discovery-s01"
export EXPECTED_PRODUCT_SHA="085f0015291419b945540b59a1d56855507f6098"
export TEST_SOURCE_SHA="e60b483a7cda6d6d0d3018b5d6e185faa3b9a4ae"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10b-pointer-delivery-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10b-pointer-delivery-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
