#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b2-dialog-semantic-actions-s01"
export EXPECTED_PRODUCT_SHA="86421b35f6413c990cebcb76f4357412266d06f7"
export TEST_SOURCE_SHA="14845076651b206b81a41b39948111fa3104ae56"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-dialog-semantic-actions.js"
export PHYSICAL_TEST_ID="physical:phase9b2-dialog-semantic-actions"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
