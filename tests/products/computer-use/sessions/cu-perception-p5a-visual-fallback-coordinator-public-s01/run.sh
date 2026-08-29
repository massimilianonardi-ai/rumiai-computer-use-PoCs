#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cu-perception-p5a-visual-fallback-coordinator-public-s01"
export EXPECTED_PRODUCT_SHA="cc9e26e87aa83239378d466d64879229fe2302bc"
export EXPECTED_CONTROL_SHA="e3a3f13d66546cf8f0fca50075bd4607c2c3d003"
export TEST_SOURCE_SHA="aaa88a862cba2f42fcecc4b21619c5b10eceeb85"
export CONTRACT_TESTS="tests/products/computer-use/external-computer-control-boundary-test.js tests/products/computer-use/visual-frame-acquisition-test.js tests/products/computer-use/perception-session-runner-test.js tests/products/computer-use/perception-physical-lifecycle-test.js tests/products/computer-use/perception-p1b-mapped-frame.test.js tests/products/computer-use/perception-p2a-local-ocr-discovery.test.js tests/products/computer-use/perception-p2b-provider-contract.test.js tests/products/computer-use/perception-p3a-target-resolution.test.js tests/products/computer-use/perception-p3b-action-policy.test.js tests/products/computer-use/perception-p4-action-execution.test.js tests/products/computer-use/perception-p5a-visual-fallback-coordinator.test.js"
export PHYSICAL_TEST="tests/products/computer-use/physical-tests/perception-p5a-visual-fallback-coordinator-public.js"
export PHYSICAL_TEST_ID="physical:computer-use-perception-p5a-visual-fallback-coordinator-public"
exec /bin/bash "$ROOT/tests/products/computer-use/session-runner.sh"
