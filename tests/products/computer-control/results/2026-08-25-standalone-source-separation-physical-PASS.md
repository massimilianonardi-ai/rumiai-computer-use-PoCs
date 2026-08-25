# Standalone source separation physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Contract/runtime/backend: `0.7.0`

The runtime, SDK, backend source, Provider Registry, desktop plugins, and Swift
helpers were loaded exclusively from `rumiai-computer-control`. The tests used a
local Node runtime and a locally installed ignored `agent-ctrl` executable.

Results:

```text
physical-runtime-snapshot-find-set-text=PASS
physical-runtime-window-v82=PASS
```

No runtime or test source path referenced `rumiai-computer-use-PoCs`. Source
provenance is recorded in `backends/macos/embedded/PROVENANCE.md`.
