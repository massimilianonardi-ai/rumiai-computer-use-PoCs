# RumiAI Computer Use — ARM64 portability convergence checkpoint (v53)

**Date:** 2026-08-23

## macOS ARM64

Primary development target. End-to-end Computer Control regression physically validated after v49–v53.

Validated:
- Node.js portable installer
- Ollama portable installer
- micromamba direct-binary installer
- POSIX `#!/bin/sh` runtime path
- agent-ctrl installer and doctor
- platform-aware context selection
- full v48 Computer Control execution semantics: application readiness, NEW_DOCUMENT, literal INPUT, explicit CLEAR, exact verification, cleanup

## Ubuntu 26.04 ARM64

Physically validated:
- Node.js portable installer
- Ollama portable installer
- micromamba direct-binary installer
- POSIX `#!/bin/sh` execution path
- service lifecycle (`srv-start` / `srv-stop`)
- Ollama server API
- headless LLM planner / context engine / prefix-cache path
- platform-aware context selection (`generic-gui -> linux`)
- macOS application contexts excluded on Linux
- diagnostic GUI boundary: unavailable action backend reported explicitly without treating the portable runtime as broken

Not claimed as validated on Linux:
- GUI Computer Control actions
- Linux application providers
- Linux native backend
- X11/Wayland automation

## Architectural boundary retained

```text
RumiAI semantic/context layers
        |
Computer Control normalized API
        |
platform/backend implementation
```

The portability work through v53 did not introduce Linux-specific behavior into semantic plans or macOS GUI execution. Platform-specific knowledge is filtered at the context/backend boundary.

## Remaining platform matrix

- macOS ARM64: primary target, physically validated end-to-end
- Linux ARM64: portable/headless baseline physically validated; GUI actions intentionally unsupported
- Linux x64: installer mappings implemented but physical validation pending

Next convergence work should be driven by a real observed platform boundary rather than speculative Linux GUI implementation.
