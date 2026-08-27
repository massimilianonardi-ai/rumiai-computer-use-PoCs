#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c2a-dock-observation-s01"
export EXPECTED_PRODUCT_SHA="b9d04f5213c5dcb00ca8dc0363f8248caa9a8916"
export TEST_SOURCE_SHA="6bbeecd7d6534b230a92fe8e4b5603f2e7d8a3c6"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-dock-observation.js"
export PHYSICAL_TEST_ID="physical:phase9c2a-dock-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
