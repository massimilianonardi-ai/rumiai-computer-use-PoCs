#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3a-file-picker-discovery-s02"
export EXPECTED_PRODUCT_SHA="5a7f6a00888838d042ce127f405fc050c07e4872"
export TEST_SOURCE_SHA="0856eb78a484a495b4eaf84809cbd1e392abf337"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-topology-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9b3a-file-picker-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
