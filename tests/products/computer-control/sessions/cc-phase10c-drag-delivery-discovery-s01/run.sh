#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10c-drag-delivery-discovery-s01"
export EXPECTED_PRODUCT_SHA="37069dcf683c168c3b9727e5b4464ff457b1222c"
export TEST_SOURCE_SHA="6c13b1e8868ec5667cc9a6e4611d4f69799dda67"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10c-drag-delivery-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10c-drag-delivery-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
