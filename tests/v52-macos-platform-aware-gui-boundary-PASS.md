# v52 — Platform-Aware GUI Backend Boundary — macOS regression

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on macOS ARM64
**Environment:** MacBook Air Apple Silicon / Darwin arm64

## Test

```text
git pull
./cmd/agent-ctrl-install
echo "agent_ctrl_install_exit=$?"
./cmd/doctor
echo "doctor_exit=$?"
```

## Observed result

```text
agent-ctrl 0.1.4
agent_ctrl_install_exit=0

RumiAI Computer Use test stack - doctor
PLATFORM: Darwin / arm64
...
[PASS] Node.js v26.7.0
[PASS] agent-loop.js syntax
[PASS] agent-ctrl agent-ctrl 0.1.4
-- agent-ctrl doctor --
summary: 6 pass, 0 warn, 0 fail
[PASS] agent-ctrl doctor
[PASS] Ollama ... client version is 0.32.15
...
[PASS] micromamba 2.9.0
...
PASS=6 WARN=3 FAIL=0
doctor_exit=0
```

The WARN entries were expected non-failures for the stopped Ollama API/model verification and optional ComfyUI absence.

## Validation

- Darwin ARM64 platform detection: PASS
- agent-ctrl v0.1.4 Darwin installer path: PASS
- agent-ctrl AX backend readiness: PASS
- macOS Accessibility permission: PASS
- agent-ctrl doctor: PASS (6 pass, 0 warn, 0 fail)
- RumiAI doctor platform-aware behavior: PASS
- doctor final FAIL count: 0
- doctor exit status: 0

v52 is physically validated on macOS ARM64 as a regression of the platform-aware GUI backend boundary.
