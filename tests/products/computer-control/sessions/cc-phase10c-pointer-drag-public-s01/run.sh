#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10c-pointer-drag-public-s01"
export EXPECTED_PRODUCT_SHA="43a26d1f369c39dbed6ca8131af8d02bd8e17b47"
export TEST_SOURCE_SHA="6877b2541c974f473067244bc939efc3ef82fcec"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10c-drag-public.js"
export PHYSICAL_TEST_ID="physical:phase10c-pointer-drag-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
