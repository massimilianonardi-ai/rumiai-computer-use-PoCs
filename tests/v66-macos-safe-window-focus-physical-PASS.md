# v66 macOS Safe Window Focus — Physical PASS

Status: PASS

Exact physical result supplied by user:

```text
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
observed-window-list=PASS
observed-window-count=2
observed-windows=[{"id":"pid:60525:window:0","title":"rumiai-v66-safe-focus-B.txt","process":"TextEdit","pid":60525,"focused":false,"pinned":true},{"id":"pid:60525:window:1","title":"rumiai-v66-safe-focus-A.txt","process":"TextEdit","pid":60525,"focused":false,"pinned":false}]
fixture-window-count=2
initial-pinned-title=rumiai-v66-safe-focus-B.txt
initial-pinned-id=pid:60525:window:0
target-title=rumiai-v66-safe-focus-A.txt
target-observed-handle=pid:60525:window:1
safe-focus-fixture-ready=PASS
observed-descriptor={"id":"pid:60525:window:1","title":"rumiai-v66-safe-focus-A.txt","process":"TextEdit","pid":60525}
front-document-before=rumiai-v66-safe-focus-B.txt
fixture-rebind-action=PASS
fixture-rebind-method=agent-ctrl focus-window pid:60525:window:1 --json
fixture-rebind-front-document=rumiai-v66-safe-focus-A.txt
fixture-rebind-independent-focus=PASS
rebound-raw-window-list=PASS
rebound-raw-windows=[{"id":"pid:60525:window:0","title":"rumiai-v66-safe-focus-A.txt","process":"TextEdit","pid":60525,"focused":false,"pinned":false},{"id":"pid:60525:window:1","title":"rumiai-v66-safe-focus-B.txt","process":"TextEdit","pid":60525,"focused":false,"pinned":true}]
old-handle-now-title=rumiai-v66-safe-focus-B.txt
target-current-handle=pid:60525:window:0
intentional-handle-rebound=PASS
safe-focus=PASS
safe-focus-state=FOCUSED
safe-focus-method=agent-ctrl focus-window pid:60525:window:0 --json
safe-focus-verified=true
safe-focus-verification=native-focused-window-descriptor
safe-focus-observed-handle=pid:60525:window:1
safe-focus-action-handle=pid:60525:window:0
safe-focus-handle-rebound=true
safe-focus-window={"title":"rumiai-v66-safe-focus-A.txt","process":"TextEdit","pid":60525}
safe-focus-native-window={"title":"rumiai-v66-safe-focus-A.txt","process":"TextEdit","pid":60525,"bundle":"com.apple.TextEdit","identifier":"_NS:34","windowNumber":null}
safe-focus-rebound-reroute=PASS
independent-front-document-after=rumiai-v66-safe-focus-A.txt
independent-safe-focus-verification=PASS
stale-handle-would-target=rumiai-v66-safe-focus-B.txt
wrong-window-avoided=PASS
physical-safe-window-focus=PASS
fixture-cleanup=WARN
runtime-close=PASS
physical_exit=0
```

Interpretation constrained to the executed test:
- The observed handle for fixture A (`pid:60525:window:1`) was intentionally rebound to fixture B before the public focus call.
- The safe focus implementation re-resolved fixture A from the preserved descriptor and selected the current action handle (`pid:60525:window:0`).
- `handleRebound=true` was reported.
- Native focused-window verification matched fixture A.
- Independent TextEdit front-document verification also matched fixture A.
- The stale original handle would have targeted fixture B; that wrong-window action was avoided.
- `fixture-cleanup=WARN` is test-only cleanup and did not invalidate the physical behavior or exit status.

Historical v66 boundary PASS remains recorded separately.
