#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3b-file-picker-navigation-selection-s02"
export EXPECTED_PRODUCT_SHA="6533489586ce51f03296a4191dc0806a88f4c66b"
export TEST_SOURCE_SHA="0374e8a02851ea250210badde57913b87cf4c53d"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-navigation-selection.js"
export PHYSICAL_TEST_ID="physical:phase9b3b-file-picker-navigation-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
