#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9a2-application-terminate-s01"
export EXPECTED_PRODUCT_SHA="2c99a708a5c78262a0df1c2d9bbbdc18cf72932a"
export TEST_SOURCE_SHA="e1b8aafd18c23cdf6516cb795e041ad3ae9a3102"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-application-termination.js"
export PHYSICAL_TEST_ID="physical:phase9a2-application-terminate"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
