# v62 macOS verified window focus — physical PASS

## Result

Physical result: **PASS**

```text
desktop=macos platform=darwin
runtime-ready=PASS
provider-path=/System/Applications/TextEdit.app
application-resolved=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
before-window-list=PASS
before-window-count=2
before-windows=[{"id":"pid:59940:window:0","title":"rumiai-v62-window-focus-B.txt","process":"TextEdit","pid":59940,"focused":false,"pinned":true},{"id":"pid:59940:window:1","title":"rumiai-v62-window-focus-A.txt","process":"TextEdit","pid":59940,"focused":false,"pinned":false}]
fixture-window-count=2
initial-pinned-title=rumiai-v62-window-focus-B.txt
initial-pinned-id=pid:59940:window:0
target-title=rumiai-v62-window-focus-A.txt
target-id=pid:59940:window:1
focus-fixture-ready=PASS
front-document-before-ok=true
front-document-before=rumiai-v62-window-focus-B.txt
window-focus=PASS
window-focus-state=FOCUSED
window-focus-method=agent-ctrl focus-window pid:59940:window:1 --json
window-focus-verified=true
window-focus-verification=window-list-target-pinned
focused-window={"id":"pid:59940:window:1","title":"rumiai-v62-window-focus-B.txt","process":"TextEdit","pid":59940,"focused":false,"pinned":true}
plugin-focus-postcondition=PASS
independent-front-document=rumiai-v62-window-focus-A.txt
independent-focus-attempts=1
independent-focus-verification=PASS
physical-window-focus=PASS
fixture-cleanup=WARN
runtime-close=PASS
physical_exit=0
```

## Classification

- Focus action delivery: PASS.
- Target stable window id changed from unpinned to `pinned=true`: PASS.
- Independent physical verification through TextEdit front document: PASS.
- Overall v62 physical behavior: PASS.
- Test fixture cleanup: WARN only; does not affect the functional result.

## Observed metadata anomaly

Immediately after the successful focus, `window-list` reported the requested target id `pid:59940:window:1` as pinned, but associated it with title `rumiai-v62-window-focus-B.txt` instead of the pre-action title `rumiai-v62-window-focus-A.txt`.

The independent physical observation showed the real front document was `rumiai-v62-window-focus-A.txt`, so the focus itself succeeded. This evidence therefore treats stable id + pinned state as the focus postcondition and records the immediate post-action title mismatch as stale/mismatched diagnostic metadata, not as a focus failure.

No source change is authorized by this observation alone; preserve it for future window-metadata consistency work.
