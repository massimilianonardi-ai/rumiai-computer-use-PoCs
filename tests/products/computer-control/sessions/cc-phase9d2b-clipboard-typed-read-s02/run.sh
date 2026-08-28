#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d2b-clipboard-typed-read-s02"
export EXPECTED_PRODUCT_SHA="52339ec3c032ef62bae80113336b6588e7135771"
export TEST_SOURCE_SHA="8cf666fb16ad364795cb8e534f27ad2d1d2598ae"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-clipboard-typed-read.js"
export PHYSICAL_TEST_ID="physical:phase9d2b-clipboard-typed-read"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
