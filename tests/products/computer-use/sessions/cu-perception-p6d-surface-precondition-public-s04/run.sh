#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
if /usr/bin/pgrep -x Safari >/dev/null 2>&1; then
  echo "SESSION_PREFLIGHT=BLOCKED"
  echo "Safari is already running; close Safari before this physical session so user browser state is not disturbed."
  exit 2
fi
export SESSION_ID="cu-perception-p6d-surface-precondition-public-s04"
export EXPECTED_PRODUCT_SHA="2aa2399ea69f70889ceba6370706ccf2187ab8e7"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="9fb765af47eac301f26d02ca3f1355e7102f94b2"
export RUMIAI_COMPUTER_CONTROL_HOME="${RUMIAI_COMPUTER_CONTROL_HOME:-/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control}"
export RUMIAI_CC_NODE="${RUMIAI_CC_NODE:-/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node}"
export PHYSICAL_TIMEOUT_MS="90000"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js tests/products/computer-use/perception-p5c-open-semantic-first.test.js tests/products/computer-use/perception-p5d-provider-selection.test.js tests/products/computer-use/perception-p5e-agent-loop-visual-fallback.test.js tests/products/computer-use/perception-p6a-caller-contract-registry.test.js tests/products/computer-use/perception-p6b-safari-canvas-discovery.test.js tests/products/computer-use/perception-p6c-scoped-caller-integration.test.js tests/products/computer-use/perception-p6d-surface-precondition.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p6d-surface-precondition-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p6d-surface-precondition-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
