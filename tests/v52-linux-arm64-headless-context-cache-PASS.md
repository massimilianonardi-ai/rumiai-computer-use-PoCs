# v52 — Headless context/cache test — Linux ARM64

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Linux ARM64
**Environment:** Ubuntu 26.04 ARM64 VM

## Test

```text
./cmd/context-session-cache-test
echo "context_test_exit=$?"
```

## Observed result

```text
RumiAI Context Session / Ollama prefix-cache micro-PoC
model: ministral-3:3b
Ollama version: 0.32.15
warmup: 105.759s
...
A1 BASE first branch
  contexts:     generic-gui -> macos
  ...
A2 BASE same-prefix branch
  ...
B1 BASE + System Settings first branch
  contexts:     generic-gui -> macos -> system-settings
  ...
B2 BASE + System Settings same-prefix branch
  ...
context_test_exit=0
```

## Validation

- `/bin/sh` launcher path: PASS
- service lifecycle integration: PASS
- Node.js ARM64 runtime: PASS
- Ollama ARM64 server/model: PASS
- `llm.js`: PASS
- `context-manager.js`: PASS
- semantic planner execution: PASS
- prefix-cache reuse behavior observed: PASS
- clean service shutdown: PASS

## Important observation

The test also exposed the next portability defect: on Linux the base context selection still includes the macOS context (`generic-gui -> macos`). This does not invalidate the headless engine test, but the OS context selection must be corrected before Linux semantic context can be considered portable.
