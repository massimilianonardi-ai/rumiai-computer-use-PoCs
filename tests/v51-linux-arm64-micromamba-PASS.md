# v51 — Direct Micromamba Binary — Linux ARM64 test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Linux ARM64
**Environment:** Ubuntu 26.04 ARM64 VM

## Test

```text
git pull
./cmd/micromamba-install
```

## Observed result

```text
2.9.0
warning  libmamba Using existing empty folder as target prefix
...
Resolving Environment ✔ Done
...
Transaction finished
```

The installer downloaded and executed micromamba 2.9.0 directly, without requiring a host `bzip2` command.

A Python 3.12 environment was created successfully at:

```text
/m/src/git/rumiai-computer-use-PoCs/env
```

The transaction installed Python 3.12.14 and pip successfully.

## Validation

- Direct Linux ARM64 micromamba binary selection: PASS
- `#!/bin/sh` execution path: PASS
- Darwin-only `xattr` branch skipped on Linux: PASS
- No system `bzip2` dependency required: PASS
- Python 3.12 environment creation: PASS

v51 is physically validated on Linux ARM64 for the micromamba installer.