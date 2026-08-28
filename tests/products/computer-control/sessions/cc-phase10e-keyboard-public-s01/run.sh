#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10e-keyboard-public-s01"
export EXPECTED_PRODUCT_SHA="7f0c67ea2b45db39a2bdaee811d1dafeb029a773"
export TEST_SOURCE_SHA="0fb3993ba9c088344d571040b38848608f6a39a6"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10e-keyboard-public.js"
export PHYSICAL_TEST_ID="physical:phase10e-keyboard-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
