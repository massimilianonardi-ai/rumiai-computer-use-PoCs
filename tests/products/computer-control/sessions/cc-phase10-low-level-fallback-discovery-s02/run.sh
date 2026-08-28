#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10-low-level-fallback-discovery-s02"
export EXPECTED_PRODUCT_SHA="82c7ac2cd1d842d50db5a27339a563e2cec919c6"
export TEST_SOURCE_SHA="96f7761647cd74ce20f4e24b139490f5b2ebbaed"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10-low-level-discovery.js"
export PHYSICAL_TEST_ID="physical:phase10-low-level-fallback-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
