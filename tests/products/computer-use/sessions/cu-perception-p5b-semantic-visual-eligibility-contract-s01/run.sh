#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p5b-semantic-visual-eligibility-contract-s01"
export EXPECTED_PRODUCT_SHA="28c654d51c1014ee826dcf24f42b6758dc67a721"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="013f841930e284dc7ff3f833eeb12a42d7a5aab6"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js"
exec /bin/bash "$ROOT/tests/products/computer-use/contract-session-runner.sh"
