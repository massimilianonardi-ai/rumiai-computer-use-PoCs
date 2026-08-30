#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p9a-external-task-invocation-transport-public-s01"
export EXPECTED_PRODUCT_SHA="c1a6d41b0c1ce16fa9b6beed93621f303a5aa72b"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="87b8e0b9deb980c649f0ee365a17a29068be754f"
export RUMIAI_COMPUTER_CONTROL_HOME="${RUMIAI_COMPUTER_CONTROL_HOME:-/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control}"
export RUMIAI_CC_NODE="${RUMIAI_CC_NODE:-/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node}"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js tests/products/computer-use/perception-p5c-open-semantic-first.test.js tests/products/computer-use/perception-p5d-provider-selection.test.js tests/products/computer-use/perception-p5e-agent-loop-visual-fallback.test.js tests/products/computer-use/perception-p6a-caller-contract-registry.test.js tests/products/computer-use/perception-p6b-safari-canvas-discovery.test.js tests/products/computer-use/perception-p6c-scoped-caller-integration.test.js tests/products/computer-use/perception-p6d-surface-precondition.test.js tests/products/computer-use/perception-p7d-pulsar-utf8-caller-contract.test.js tests/products/computer-use/perception-p7e-agent-loop-caller-context.test.js tests/products/computer-use/perception-p8a-caller-context-provenance-gap.test.js tests/products/computer-use/perception-p8b-task-resource-context.test.js tests/products/computer-use/perception-p8c-agent-loop-task-resource-context.test.js tests/products/computer-use/perception-p8e-task-invocation-owner.test.js tests/products/computer-use/perception-p9a-external-task-invocation-transport.test.js"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
