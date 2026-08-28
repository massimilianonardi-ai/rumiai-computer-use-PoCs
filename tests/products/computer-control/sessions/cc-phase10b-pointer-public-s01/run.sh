#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10b-pointer-public-s01"
export EXPECTED_PRODUCT_SHA="a02b9e0dbac6ca50e882657eba46a96f7582aa4b"
export TEST_SOURCE_SHA="cd8a75594331cf30d776b9c6749e6fcfe0045a73"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10b-pointer-public.js"
export PHYSICAL_TEST_ID="physical:phase10b-pointer-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
