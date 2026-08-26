#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8a-text-selection-s04"
export EXPECTED_PRODUCT_SHA="4166cab8c6b535d627c0f93fe0015ad3c69fcc6a"
export TEST_SOURCE_SHA="cdf869ba43f1a6294a7349ca5a66daeadc726209"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-selection.js"
export PHYSICAL_TEST_ID="physical:phase8a-text-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
