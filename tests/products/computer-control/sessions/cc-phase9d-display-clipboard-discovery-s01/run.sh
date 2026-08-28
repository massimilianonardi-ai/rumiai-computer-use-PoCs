#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase9d-display-clipboard-discovery-s01"
export EXPECTED_PRODUCT_SHA="6e651f4c226e670ea45ed4b0139b3fe0eff8baac"
export TEST_SOURCE_SHA="68c76aa89d838641baac95abff4f89f47ac96d19"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase9d-display-clipboard-discovery.js"
export PHYSICAL_TEST_ID="physical:phase9d-display-clipboard-discovery"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
