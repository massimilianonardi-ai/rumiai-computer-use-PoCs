#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10a-display-capture-s03"
export EXPECTED_PRODUCT_SHA="ec3cd5f07defacdbe8b634a61b99d5510f77d832"
export TEST_SOURCE_SHA="2375e53952ef72afd32c61a5d79e9b97d374f88c"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10a-display-capture.js"
export PHYSICAL_TEST_ID="physical:phase10a-display-capture"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
