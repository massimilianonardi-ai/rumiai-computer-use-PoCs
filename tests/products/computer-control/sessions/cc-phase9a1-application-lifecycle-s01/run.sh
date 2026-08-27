#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9a1-application-lifecycle-s01"
export EXPECTED_PRODUCT_SHA="5e36c5fd098ac50f80e439f1bb4e778e73c3fd86"
export TEST_SOURCE_SHA="fbf5d3e2c0eee168327bf4d1517d11551a762295"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-application-lifecycle.js"
export PHYSICAL_TEST_ID="physical:phase9a1-application-lifecycle"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
