#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d2c-clipboard-typed-write-s01"
export EXPECTED_PRODUCT_SHA="a3bcb2cc9f9f374958b6816c32be06cb6c12908a"
export TEST_SOURCE_SHA="57d4d002d1ecaf1cb673eaa144dbd883502c2e93"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-clipboard-typed-write.js"
export PHYSICAL_TEST_ID="physical:phase9d2c-clipboard-typed-write"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
