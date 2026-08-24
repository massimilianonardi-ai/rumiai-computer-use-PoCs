# v59 macOS window close diagnostic — PASS

Date: 2026-08-24
Platform: macOS / Darwin arm64

## Result

Diagnostic harness completed successfully (`diagnostic_exit=0`) and isolated the verification defect.

## Physical behavior already observed

- `Cmd+W` physically closed the TextEdit window.
- The v59 implementation still returned `WINDOW_CLOSE_UNVERIFIED` because `getCurrentWindow()` continued to report the pre-close window id.

## Diagnostic evidence

Before close:

```text
before-window-ok=true
before-window={"field":"window","value":{"id":"pid:59146:window:0","title":"rumiai-v59-window-close-diagnostic.txt"}}
before-fingerprint=id:pid:59146:window:0
before-snapshot-ok=true
```

Close path:

```text
close-ok=false
close-state=UNVERIFIED
close-error=WINDOW_CLOSE_UNVERIFIED
close-method=agent-ctrl press Cmd+W
close-verified=false
plugin-after-window={"field":"window","value":{"id":"pid:59146:window:0","title":"rumiai-v59-window-close-diagnostic.txt"}}
```

After physical close:

```text
after-foreground-ok=true
after-foreground=TextEdit com.apple.TextEdit
after-window-ok=true
after-window={"field":"window","value":{"id":"pid:59146:window:0","title":"rumiai-v59-window-close-diagnostic.txt"}}
after-snapshot-ok=false
wait-until-changed=NOT_CHANGED
wait-until-changed-attempts=19
wait-until-changed-error=RESOURCE_NOT_READY
diagnostic-complete=PASS
runtime-close=PASS
diagnostic_exit=0
```

## Conclusion

`agent-ctrl get window --json` is stale after this physical close and cannot be the sole close postcondition.

The accessibility snapshot is fresher: after the window is physically closed, `snapshotApplication()` no longer produces a valid TextEdit window snapshot while the TextEdit process remains foreground.

The v59 verification should therefore be based on fresh AX window presence/identity, not on `getCurrentWindow()` changing.

Status: DIAGNOSTIC PASS / v59 implementation still NOT VALIDATED.
