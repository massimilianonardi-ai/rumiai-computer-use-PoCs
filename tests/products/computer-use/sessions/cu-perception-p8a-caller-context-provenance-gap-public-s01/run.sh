#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p8a-caller-context-provenance-gap-public-s01"
export EXPECTED_PRODUCT_SHA="e22a4657e6284f5e4e61bfeddd0bb5b80c2a0473"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="139862b8e4ac24c953548b0ca1e78644eb9f3fe5"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js tests/products/computer-use/perception-p5c-open-semantic-first.test.js tests/products/computer-use/perception-p5d-provider-selection.test.js tests/products/computer-use/perception-p5e-agent-loop-visual-fallback.test.js tests/products/computer-use/perception-p6a-caller-contract-registry.test.js tests/products/computer-use/perception-p6b-safari-canvas-discovery.test.js tests/products/computer-use/perception-p6c-scoped-caller-integration.test.js tests/products/computer-use/perception-p6d-surface-precondition.test.js tests/products/computer-use/perception-p7d-pulsar-utf8-caller-contract.test.js tests/products/computer-use/perception-p7e-agent-loop-caller-context.test.js tests/products/computer-use/perception-p8a-caller-context-provenance-gap.test.js"
exec /bin/bash "$ROOT/tests/products/computer-use/contract-session-runner.sh"
