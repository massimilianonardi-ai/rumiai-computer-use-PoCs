#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c1-menu-bar-discovery-s02"
export EXPECTED_PRODUCT_SHA="ebce7c87c264932144909a491d04c7f307b4cafe"
export TEST_SOURCE_SHA="72790fd9dbd8142ff71f34d823443dea107fd382"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-menu-bar-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9c1-menu-bar-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
