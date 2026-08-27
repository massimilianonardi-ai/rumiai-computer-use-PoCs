#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c23-system-chrome-discovery-s01"
export EXPECTED_PRODUCT_SHA="979ecb74dd486da832a96f02486dec7e71b42236"
export TEST_SOURCE_SHA="35ba8c86cbfa3c23ef513410e658e000af8b1a2e"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-system-chrome-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9c23-system-chrome-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
