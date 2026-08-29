#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED cannot resolve PoC repository from script path" >&2; exit 2; }
cd "$ROOT" || { echo "SESSION_PREFLIGHT=BLOCKED cannot enter PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p5c-open-semantic-first-public-s04"
export EXPECTED_PRODUCT_SHA="7a03bf5d1ada22ebd1193ae7f492e0a1e24e2d8b"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="f84b5a4f365196f959a0abc8ef186e296401b3b2"
export RUMIAI_COMPUTER_CONTROL_HOME="${RUMIAI_COMPUTER_CONTROL_HOME:-/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control}"
export RUMIAI_CC_NODE="${RUMIAI_CC_NODE:-/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node}"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js tests/products/computer-use/perception-p5b-semantic-visual-eligibility.test.js tests/products/computer-use/perception-p5c-open-semantic-first.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p5c-open-semantic-first-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p5c-open-semantic-first-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
