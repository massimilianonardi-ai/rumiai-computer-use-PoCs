#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d2c-clipboard-restoration-discovery-s01"
export EXPECTED_PRODUCT_SHA="a3bcb2cc9f9f374958b6816c32be06cb6c12908a"
export TEST_SOURCE_SHA="c77d97a360e986aafe9c9cb4731a15c1769fd776"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-clipboard-restoration-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9d2c-clipboard-restoration-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
