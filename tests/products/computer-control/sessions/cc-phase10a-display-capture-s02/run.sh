#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10a-display-capture-s02"
export EXPECTED_PRODUCT_SHA="06c55cfd47f6ca4032826538c48ee52e583b9a81"
export TEST_SOURCE_SHA="a7b7c2851e4bb91ede8ab793cf7753a40f147031"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10a-display-capture.js"
export PHYSICAL_TEST_ID="physical:phase10a-display-capture"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
