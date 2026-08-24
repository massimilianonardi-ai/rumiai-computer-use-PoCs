# v63 macOS Window Focus Facade Physical PASS

Date: 2026-08-24
Platform: macOS / darwin

## Result

Physical facade validation: PASS

The public `ComputerControl.focusWindow({app, window:{id}})` path successfully focused the requested TextEdit window using the stable window id. The plugin postcondition reported the requested id as pinned, and an independent AppleScript observation confirmed the requested TextEdit document became the front document.

## Essential output

```text
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
facade-window-list=PASS
facade-window-count=2
fixture-window-count=2
focus-fixture-ready=PASS
front-document-before=rumiai-v63-window-focus-facade-B.txt
facade-window-focus=PASS
facade-window-focus-state=FOCUSED
facade-window-focus-method=agent-ctrl focus-window pid:60087:window:1 --json
facade-window-focus-verified=true
facade-window-focus-verification=window-list-target-pinned
facade-focus-postcondition=PASS
independent-front-document=rumiai-v63-window-focus-facade-A.txt
independent-focus-attempts=1
independent-focus-verification=PASS
physical-window-focus-facade=PASS
fixture-cleanup=WARN
runtime-close=PASS
physical_exit=0
```

## Observed metadata anomaly

As already observed in v62, the post-focus `window-list` metadata associated the correct focused/pinned target id with the stale title of the previously pinned document:

```text
facade-focused-window={"id":"pid:60087:window:1","title":"rumiai-v63-window-focus-facade-B.txt",..."pinned":true}
```

This does not invalidate the focus result because:
- the requested stable target id became `pinned=true`;
- the facade contract is intentionally id-first;
- the independent physical observation confirmed the actual front document was `rumiai-v63-window-focus-facade-A.txt`.

The stale title/ID association remains a separate observation-metadata debt and is not used as an action target.

## Classification

v63 physical facade behavior: PASS.
`fixture-cleanup=WARN` is test-only cleanup and did not affect the functional result or exit status.
