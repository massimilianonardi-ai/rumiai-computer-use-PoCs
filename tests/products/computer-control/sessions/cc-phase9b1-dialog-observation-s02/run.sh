#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b1-dialog-observation-s02"
export EXPECTED_PRODUCT_SHA="2e7aaa24572fe5d55262d8cdce7f8fbc06cfaa58"
export TEST_SOURCE_SHA="24ce607d8dbbf72a8c60c586a402ffe704d59440"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-dialog-observation.js"
export PHYSICAL_TEST_ID="physical:phase9b1-dialog-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
