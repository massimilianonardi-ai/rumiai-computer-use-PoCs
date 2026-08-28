#!/bin/bash
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "SESSION_PREFLIGHT=BLOCKED not inside PoC repository" >&2; exit 2; }
export SESSION_ID="cc-phase10b-pointer-public-s02"
export EXPECTED_PRODUCT_SHA="3f68502848f127d73f72cac023deed511f3ce75d"
export TEST_SOURCE_SHA="167a42a59b8bb11c1c9a20b780f6b19607e98a86"
export PHYSICAL_TEST="tests/products/computer-control/physical-tests/macos-phase10b-pointer-public.js"
export PHYSICAL_TEST_ID="physical:phase10b-pointer-public"
exec /bin/bash "$ROOT/tests/products/computer-control/session-runner.sh"
