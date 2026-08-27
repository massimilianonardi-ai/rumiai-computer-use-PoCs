#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8c-text-mutation-s03"
export EXPECTED_PRODUCT_SHA="d679a89a88977a70c450eec9e1aece6c7b2a6506"
export TEST_SOURCE_SHA="55e8dc67a5878c000512ebdb8d515aff8d185369"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-mutation.js"
export PHYSICAL_TEST_ID="physical:phase8c-text-mutation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
