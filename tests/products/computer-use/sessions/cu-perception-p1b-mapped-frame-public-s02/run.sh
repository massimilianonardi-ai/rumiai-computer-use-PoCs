#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p1b-mapped-frame-public-s02"
export EXPECTED_PRODUCT_SHA="29c269864def0a26d3254e913d2a5a87f6125103"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="807747c79ea2a46dac618afb520990548b2b53fe"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-coordinate-mapping-discovery.test.js tests/products/computer-use/perception-p1b-mapped-frame.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p1b-mapped-frame-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p1b-mapped-frame-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
