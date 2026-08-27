#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9b3b-directory-actions-discovery-s01"
export EXPECTED_PRODUCT_SHA="6533489586ce51f03296a4191dc0806a88f4c66b"
export TEST_SOURCE_SHA="be4f050e5b7ea4882815957a2ff6fb6c3a0bf2df"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-file-picker-directory-actions-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9b3b-directory-actions-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
