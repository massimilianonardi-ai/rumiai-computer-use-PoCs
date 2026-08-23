# v50 — POSIX Shell Portability — Linux ARM64 micromamba test

**Date:** 2026-08-23
**Status:** FAIL on Linux ARM64
**Environment:** Ubuntu 26.04 ARM64 VM

## Test

```text
git pull
./cmd/micromamba-install
```

## Observed output

```text
tar (grandchild): bzip2: funzione "exec" non riuscita: File o directory non esistente
tar (grandchild): Error is not recoverable: exiting now
tar: Child died with signal 13
tar: Error is not recoverable: exiting now
```

## Classification

The POSIX `sh` change itself did not fail and the macOS-only `xattr` branch was not reached on Linux. The failure occurs earlier while extracting the micromamba archive: GNU tar attempts to execute an external `bzip2` decompressor, which is not installed in this Ubuntu VM.

This is a portability/dependency issue in `cmd/micromamba-install`, not a failure of the `#!/bin/sh` policy.
