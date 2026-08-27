#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c1a-menu-bar-observation-s02"
export EXPECTED_PRODUCT_SHA="d0d1d23eedb7258d1fc292e3647559cf96d726d5"
export TEST_SOURCE_SHA="2018e5ede25b44dc5f68285ce103ec5eb3355bfd"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-menu-bar-observation.js"
export PHYSICAL_TEST_ID="physical:phase9c1a-menu-bar-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
