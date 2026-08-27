#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3b-file-picker-navigation-selection-s01"
export EXPECTED_PRODUCT_SHA="6d25a1773c615ab7ac3e8cd17105d660b13a39a3"
export TEST_SOURCE_SHA="ee95b4f482f26516c403cfafd57b4711bd0e5500"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-navigation-selection.js"
export PHYSICAL_TEST_ID="physical:phase9b3b-file-picker-navigation-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
