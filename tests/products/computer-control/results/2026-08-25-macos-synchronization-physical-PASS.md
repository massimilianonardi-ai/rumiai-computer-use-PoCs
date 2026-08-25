# macOS synchronization physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Contract/runtime/backend: `0.5.0`

Observed evidence:

```text
clear-empty-exact=PASS
state-changed=PASS
clipboard-paste-exact=PASS
state-stable=PASS
physical-runtime-snapshot-find-set-text=PASS
```

The changed comparison used compact snapshots on both sides. Stability was
observed before the exact post-paste property readback.
