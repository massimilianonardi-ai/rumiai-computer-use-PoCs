#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase8a-text-selection-s03"
export EXPECTED_PRODUCT_SHA="6be2aef9b0f38c3ad2e92893b9879a87a35a4e50"
export TEST_SOURCE_SHA="b20292ce4b2cea8d5e34719af37f354fb3df3cb8"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-native-text-selection.js"
export PHYSICAL_TEST_ID="physical:phase8a-text-selection"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
