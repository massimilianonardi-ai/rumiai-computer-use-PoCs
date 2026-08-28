#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10-low-level-fallback-discovery-s03"
export EXPECTED_PRODUCT_SHA="82c7ac2cd1d842d50db5a27339a563e2cec919c6"
export TEST_SOURCE_SHA="5a580668bf3e0edad1749f0c9c814b471599c9e6"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10-low-level-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10-low-level-fallback-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
