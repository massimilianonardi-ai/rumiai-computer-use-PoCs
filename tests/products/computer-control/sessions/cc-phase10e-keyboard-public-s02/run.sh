#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10e-keyboard-public-s02"
export EXPECTED_PRODUCT_SHA="e2eb419c352f5996ce45ad6c13b37d7ea52c8c21"
export TEST_SOURCE_SHA="cfc8460f31772f5e6f6a10505fbc71fc9f6d8887"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10e-keyboard-public.js"
export PHYSICAL_TEST_ID="physical:phase10e-keyboard-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
