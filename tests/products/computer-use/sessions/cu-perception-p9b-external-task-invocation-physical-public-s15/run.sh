#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
if /usr/bin/pgrep -x Pulsar >/dev/null 2>&1 || /usr/bin/pgrep -f '/Pulsar.app/Contents/MacOS/Pulsar' >/dev/null 2>&1; then
  echo "SESSION_PREFLIGHT=BLOCKED"
  echo "Pulsar is already running; close Pulsar before this physical session so user editor state is not disturbed."
  exit 2
fi
export SESSION_ID="cu-perception-p9b-external-task-invocation-physical-public-s15"
export EXPECTED_PRODUCT_SHA="cd1d189776e96d7f8625b367eaa76a2572de394a"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="683211e731310124e34ca4a3957ddca1eb7ea76d"
export RUMIAI_COMPUTER_CONTROL_HOME="${RUMIAI_COMPUTER_CONTROL_HOME:-/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control}"
export RUMIAI_CC_NODE="${RUMIAI_CC_NODE:-/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node}"
export PHYSICAL_TIMEOUT_MS="90000"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js tests/products/computer-use/perception-p5c-open-semantic-first.test.js tests/products/computer-use/perception-p5d-provider-selection.test.js tests/products/computer-use/perception-p5e-agent-loop-visual-fallback.test.js tests/products/computer-use/perception-p6a-caller-contract-registry.test.js tests/products/computer-use/perception-p6b-safari-canvas-discovery.test.js tests/products/computer-use/perception-p6c-scoped-caller-integration.test.js tests/products/computer-use/perception-p6d-surface-precondition.test.js tests/products/computer-use/perception-p7d-pulsar-utf8-caller-contract.test.js tests/products/computer-use/perception-p7e-agent-loop-caller-context.test.js tests/products/computer-use/perception-p8a-caller-context-provenance-gap.test.js tests/products/computer-use/perception-p8b-task-resource-context.test.js tests/products/computer-use/perception-p8c-agent-loop-task-resource-context.test.js tests/products/computer-use/perception-p8e-task-invocation-owner.test.js tests/products/computer-use/perception-p9a-external-task-invocation-transport.test.js tests/products/computer-use/perception-p9b-task-invocation-lifecycle.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p9b-pulsar-external-task-invocation-s15-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p9b-pulsar-external-task-invocation-s15-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
