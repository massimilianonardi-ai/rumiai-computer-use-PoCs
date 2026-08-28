#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p2a-local-ocr-discovery-s02"
export EXPECTED_PRODUCT_SHA="a47ada40d6c01dc703c745dc22d046329fe34aea"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="fc3b59a837c7858c78501d1e51c36b65ee5be661"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-mapped-frame.test.js tests/products/computer-use/perception-p2a-local-ocr-discovery.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p2a-local-ocr-discovery.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p2a-local-ocr-discovery"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
