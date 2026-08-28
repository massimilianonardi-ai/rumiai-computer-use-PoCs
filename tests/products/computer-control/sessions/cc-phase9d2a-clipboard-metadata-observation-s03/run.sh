#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d2a-clipboard-metadata-observation-s03"
export EXPECTED_PRODUCT_SHA="bbf6579a2d291d16cde02c3371e5b31495a92287"
export TEST_SOURCE_SHA="af5fcf98cfc770302cd1e34c011d46fdeca5adc3"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-clipboard-metadata-observation.js"
export PHYSICAL_TEST_ID="physical:phase9d2a-clipboard-metadata-observation"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
