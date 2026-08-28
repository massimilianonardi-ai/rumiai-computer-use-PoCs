#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p1b-coordinate-mapping-discovery-s01"
export EXPECTED_PRODUCT_SHA="98435ba98791f29a58fb2b5f55e27d7688d4e8b9"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="a1bef98ce1478777353ee764bc332c51c0ee65a3"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-coordinate-mapping-discovery.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p1b-coordinate-mapping-discovery.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p1b-mapping-discovery"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
