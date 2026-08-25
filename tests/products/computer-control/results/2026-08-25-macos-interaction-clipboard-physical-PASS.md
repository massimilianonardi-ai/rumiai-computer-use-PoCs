# macOS interaction and clipboard physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Contract/runtime/backend: `0.4.0`

Observed evidence:

```text
focus-delivered=PASS
click-delivered=PASS
press-delivered=PASS
clear-verified=PASS
clear-empty-exact=PASS
clipboard-write-exact=PASS
clipboard-copy-exact=PASS
clipboard-paste-exact=PASS
physical-runtime-snapshot-find-set-text=PASS
```

The existing clipboard value was retained only in memory and restored after the
test. Its content was not logged. Paste verification required state settling
before exact readback, confirming the need for explicit synchronization.
