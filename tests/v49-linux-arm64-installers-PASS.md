# v49 — Platform Installer URLs — Linux ARM64 test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Linux ARM64 for Node.js and Ollama installer selection/extraction
**Environment:** Ubuntu 26.04 ARM64 VM, `uname -s` = `Linux`, `uname -m` = `aarch64`

## Test

```text
uname -s
uname -m
./cmd/nodejs-install
./cmd/ollama-install
```

## Observed output

```text
Linux
aarch64
v26.7.0
...
100 1.43G ...
Warning: could not connect to a running Ollama instance
Warning: client version is 0.32.15
```

## Interpretation

- Platform detection selected the Linux ARM64 Node.js archive successfully.
- Node.js installed and executed successfully as `v26.7.0`.
- Platform detection selected the Linux ARM64 Ollama archive successfully.
- Ollama downloaded/extracted successfully and the installed client executed, reporting version `0.32.15`.
- `could not connect to a running Ollama instance` is expected in this installer-only test because no Ollama server was started.

## Scope of validation

This validates v49 installer behavior on **Linux ARM64 only**. macOS remains previously validated at v48 but the v49 installer changes still require a macOS regression test. Linux x64 remains untested physically.
