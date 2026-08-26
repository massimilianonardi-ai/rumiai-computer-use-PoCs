#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8c-text-mutation-s01"
export EXPECTED_PRODUCT_SHA="a9366f2efd23fe2830e0ab88b428e02df205909e"
export TEST_SOURCE_SHA="f92c5fb26f7e600e110efa45360fcaaf08f4a3c9"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-mutation.js"
export PHYSICAL_TEST_ID="physical:phase8c-text-mutation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
