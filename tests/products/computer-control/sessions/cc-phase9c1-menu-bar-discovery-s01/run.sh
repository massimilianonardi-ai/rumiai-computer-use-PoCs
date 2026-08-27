#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c1-menu-bar-discovery-s01"
export EXPECTED_PRODUCT_SHA="ebce7c87c264932144909a491d04c7f307b4cafe"
export TEST_SOURCE_SHA="05ff98d93d741d820f6a79867530d1579600bf9e"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-menu-bar-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9c1-menu-bar-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
