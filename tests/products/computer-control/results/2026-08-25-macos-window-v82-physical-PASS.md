# macOS v82 window matrix physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Contract/runtime/backend: `0.6.0`

Observed evidence:

```text
window-list=PASS
window-current=PASS
window-focus=PASS
window-minimize=PASS
window-restore=PASS
window-move=PASS
window-resize=PASS
window-maximize=PASS
window-position-restored=PASS
window-size-restored=PASS
window-close=PASS
physical-runtime-window-v82=PASS
```

The close fixture used a controlled survivor window, matching the validated
descriptor-count verification semantics. Temporary files and windows were
closed and removed. Public geometry is canonicalized to width/height.
