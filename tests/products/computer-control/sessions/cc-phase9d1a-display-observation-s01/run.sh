#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d1a-display-observation-s01"
export EXPECTED_PRODUCT_SHA="25c9052c514926f783d6c315cad2e14a5fa55311"
export TEST_SOURCE_SHA="a7bd10dc6d522014e1c262a5691ad93c2f5245dd"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-display-observation.js"
export PHYSICAL_TEST_ID="physical:phase9d1a-display-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
