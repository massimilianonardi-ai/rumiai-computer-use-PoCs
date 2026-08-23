# v49–v51 — Portable installers — macOS ARM64 regression test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on macOS ARM64
**Environment:** MacBook Air Apple Silicon

## Test

```text
git pull
./cmd/nodejs-install
echo "node_exit=$?"
./cmd/ollama-install
echo "ollama_exit=$?"
./cmd/micromamba-install
echo "micromamba_exit=$?"
```

## Observed result

```text
v26.7.0
node_exit=0

Warning: could not connect to a running Ollama instance
Warning: client version is 0.32.15
ollama_exit=0

2.9.0
...
Transaction finished
micromamba_exit=0
```

The Ollama warning is expected when the server is not running and does not indicate installer failure.

Micromamba downloaded the direct macOS ARM64 binary, executed successfully, and created the Python 3.12 environment at the repository-local prefix.

## Validation

- Node.js macOS ARM64 URL selection/download/extraction: PASS
- Node.js portable binary execution: PASS (`v26.7.0`)
- Ollama macOS ARM64 URL selection/download/extraction: PASS
- Ollama portable client execution: PASS (`0.32.15`)
- micromamba direct macOS ARM64 binary selection/download: PASS (`2.9.0`)
- Darwin-only `xattr` path did not block installation: PASS
- Python 3.12 environment creation through micromamba: PASS
- `#!/bin/sh` execution path for all three installers: PASS

This closes the macOS regression for the portable installer changes introduced across v49–v51.