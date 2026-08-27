#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9c3a-menu-extras-observation-s01"
export EXPECTED_PRODUCT_SHA="042d587299852f517022e6792874ec4fae7d826c"
export TEST_SOURCE_SHA="f4946f51b39a64e870c5c4a3ee3e73e1cab1e147"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-menu-extras-observation.js"
export PHYSICAL_TEST_ID="physical:phase9c3a-menu-extras-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
