# v64 macOS Window Handle Stability Diagnostic — REBOUND CONFIRMED

Date: 2026-08-24
Platform: macOS / darwin
Result: DIAGNOSTIC PASS — HANDLE REBINDING CONFIRMED

## Physical execution

```text
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
before-window-list=PASS
before-window-count=2
before-windows=[{"id":"pid:60184:window:0","title":"rumiai-v64-window-handle-B.txt","process":"TextEdit","pid":60184,"focused":false,"pinned":true},{"id":"pid:60184:window:1","title":"rumiai-v64-window-handle-A.txt","process":"TextEdit","pid":60184,"focused":false,"pinned":false}]
fixture-window-count=2
initial-pinned-title=rumiai-v64-window-handle-B.txt
initial-pinned-id=pid:60184:window:0
target-title=rumiai-v64-window-handle-A.txt
target-id=pid:60184:window:1
handle-fixture-ready=PASS
observed-handle={"id":"pid:60184:window:1","title":"rumiai-v64-window-handle-A.txt","process":"TextEdit","pid":60184}
focus-action=PASS
focus-action-state=FOCUSED
focus-action-verified=true
focus-action-window={"id":"pid:60184:window:1","title":"rumiai-v64-window-handle-B.txt","process":"TextEdit","pid":60184,"focused":false,"pinned":true}
after-raw-window-list=PASS
after-raw-windows=[{"id":"pid:60184:window:0","title":"rumiai-v64-window-handle-A.txt","process":"TextEdit","pid":60184,"focused":false,"pinned":false},{"id":"pid:60184:window:1","title":"rumiai-v64-window-handle-B.txt","process":"TextEdit","pid":60184,"focused":false,"pinned":true}]
old-id-now-title=rumiai-v64-window-handle-B.txt
target-title-now-id=pid:60184:window:0
same-id-still-same-window=false
same-window-still-same-id=false
window-handle-stability=REBOUND
independent-front-document=rumiai-v64-window-handle-A.txt
independent-focus-attempts=1
independent-focus-verification=PASS
diagnostic-complete=PASS
fixture-cleanup=WARN
runtime-close=PASS
diagnostic_exit=0
```

## Finding

The macOS agent-ctrl window id `pid:<pid>:window:<index>` is not a stable window identity. It is an ephemeral positional handle derived from the current AXWindows index. After focusing fixture A, the AX window order changed:

- Before focus, `window:1` described fixture A.
- After focus, `window:1` described fixture B.
- Fixture A moved to `window:0`.

Therefore both of the following are false after the focus-induced reorder:

- same id still means same physical window;
- same physical window still has the same id.

The independent TextEdit front-document observation confirmed the physical focus action itself succeeded. The issue is handle identity stability, not focus delivery.

## Architectural consequence

RumiAI must treat the macOS agent-ctrl window id as an ephemeral action handle, not a durable identity. Any operation that acts on a previously observed handle must revalidate that the current `{id,pid,process,title}` binding still matches the observation before executing. A mismatch must fail safely rather than acting on the window currently occupying that positional id.

`fixture-cleanup=WARN` is test-only cleanup and does not affect the diagnostic result.
