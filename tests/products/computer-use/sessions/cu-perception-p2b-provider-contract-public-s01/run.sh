#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p2b-provider-contract-public-s01"
export EXPECTED_PRODUCT_SHA="839d53d100e31da2fec839351f94f197d377ab36"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="0f61c2b533b87ac85ebecfd12316a20218d95d58"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-mapped-frame.test.js tests/products/computer-use/perception-p2a-local-ocr-discovery.test.js tests/products/computer-use/perception-p2b-provider-contract.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p2b-provider-contract-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p2b-provider-contract-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
