#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p4-action-execution-public-s01"
export EXPECTED_PRODUCT_SHA="5dc3607ff18b20ab806b9bf455b68f962a005e9f"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="6c776dc0f811835850ccf3933b9b247364f8c1a3"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-mapped-frame.test.js tests/products/computer-use/perception-p2a-local-ocr-discovery.test.js tests/products/computer-use/perception-p2b-provider-contract.test.js tests/products/computer-use/perception-p3a-target-resolution.test.js tests/products/computer-use/perception-p3b-action-policy.test.js tests/products/computer-use/perception-p4-action-execution.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p4-action-execution-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p4-action-execution-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
