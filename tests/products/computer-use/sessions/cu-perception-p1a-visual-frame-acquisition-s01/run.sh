#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p1a-visual-frame-acquisition-s01"
export EXPECTED_PRODUCT_SHA="322b5cdf3d7003a64910fcc46927225405150213"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="ea3a6b74ddcfef453723cf54195270d0bc113f11"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/visual-frame-acquisition-physical.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p1a"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
