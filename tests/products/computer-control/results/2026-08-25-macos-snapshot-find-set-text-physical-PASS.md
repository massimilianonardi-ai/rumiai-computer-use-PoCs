# macOS snapshot → find → setText physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Environment:

- macOS on Apple Silicon (`arm64`);
- Darwin release observed by runtime: `25.5.0`;
- backend: `macos-agent-ctrl-v46-transition`;
- contract/runtime: `0.2.0`;
- TextEdit isolated temporary file;
- local JSON-RPC over Unix domain socket.

Observed evidence:

```text
runtime-info=PASS
runtime-ready=PASS
snapshot-observed=PASS
editable-ref-fresh=PASS
editable-role=text-field
set-text-state=VERIFIED
set-text-verified=true
set-text-verification=ax-text-exact
physical-runtime-snapshot-find-set-text=PASS
```

The editable reference was obtained from the current snapshot. No coordinate,
persisted reference, or LLM-generated handle was used. The fixture was saved,
closed, and removed after the test.
