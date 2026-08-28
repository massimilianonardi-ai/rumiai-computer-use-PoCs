#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10d-pointer-wheel-public-s01"
export EXPECTED_PRODUCT_SHA="a3fcd4cbaa4f770e59bd974c0239b9af35701e99"
export TEST_SOURCE_SHA="7a0d62b2723bd0dca11e57a9b8aa931251a6f475"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10d-wheel-public.js"
export PHYSICAL_TEST_ID="physical:phase10d-pointer-wheel-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
