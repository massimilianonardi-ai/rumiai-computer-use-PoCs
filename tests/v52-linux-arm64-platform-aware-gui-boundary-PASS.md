# v52 — Platform-Aware GUI Backend Boundary — Linux ARM64 test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Linux ARM64
**Environment:** Ubuntu 26.04 ARM64 VM (`Linux / aarch64`)

## Test

```text
git pull
./cmd/doctor
echo "doctor_exit=$?"
./cmd/agent-ctrl-install
echo "install_exit=$?"
./cmd/agent-ctrl-start-cu-test
echo "cu_exit=$?"
```

## Observed result

```text
PLATFORM: Linux / aarch64
[PASS] Node.js v26.7.0
[PASS] agent-loop.js syntax
[WARN] agent-ctrl action backend unavailable on Linux; GUI Computer Control test skipped
[PASS] Ollama ... client version is 0.32.15
[PASS] micromamba 2.9.0
PASS=4 WARN=4 FAIL=0
doctor_exit=0
agent-ctrl action backend is not available on Linux in v0.1.4; Computer Control GUI remains unsupported on this platform.
install_exit=2
RumiAI Computer Control GUI is not yet supported on Linux: agent-ctrl v0.1.4 has no Linux action backend.
cu_exit=2
```

## Validation

- platform-aware doctor: PASS
- portable runtime diagnosed independently from GUI backend: PASS
- Linux agent-ctrl installer guard: PASS
- Linux GUI launcher guard: PASS
- no false Computer Control support claim: PASS

v52 is physically validated on Linux ARM64 for the platform-aware GUI backend boundary.
