# Runtime and setText boundary result

Date: 2026-08-25

Status: `BOUNDARY_PASS`

Validated locally:

- repository structure and JSON syntax;
- `runtime.info` through a Unix domain socket;
- `runtime.ensureReady` result mapping;
- strict verified `ui.setText` result mapping using a deterministic mock;
- rejection of empty `setText` with `recoveryPolicy=NONE`;
- `runtime.shutdown` result mapping;
- real runtime lifecycle against the macOS agent-ctrl transition backend.

Observed real-backend lifecycle:

```text
runtime.ready
contractVersion=0.1.0
backend=macos-agent-ctrl-v46-transition
runtime.ensureReady=READY
runtime.shutdown=STOPPED
runtime.stopped
```

The physical GUI path through the new RPC boundary has not yet been run because
the public observation APIs required to obtain a fresh `@e` reference have not
been promoted. No coordinate or stale element reference was invented.
