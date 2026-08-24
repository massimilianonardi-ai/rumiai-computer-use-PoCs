# RumiAI Computer Control micro-PoC v67

## macOS Close Window Ephemeral Handle Diagnostic

Result: **PASS / FALSE_NEGATIVE CONFIRMED**

The historical closeWindow() verifier returned UNVERIFIED even though the requested TextEdit window was physically closed. The surviving TextEdit window reused the closed window's positional agent-ctrl handle.

Exact physical output:

```text
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
before-window-list=PASS
before-window-count=2
before-windows=[{"id":"pid:60698:window:0","title":"rumiai-v67-close-handle-B.txt","process":"TextEdit","pid":60698,"focused":false,"pinned":true},{"id":"pid:60698:window:1","title":"rumiai-v67-close-handle-A.txt","process":"TextEdit","pid":60698,"focused":false,"pinned":false}]
front-document-before-ok=true
front-document-before=rumiai-v67-close-handle-B.txt
fixture-window-count=2
closed-title=rumiai-v67-close-handle-B.txt
closed-before-handle=pid:60698:window:0
survivor-title=rumiai-v67-close-handle-A.txt
survivor-before-handle=pid:60698:window:1
close-fixture-ready=PASS
public-close-ok=false
public-close-state=UNVERIFIED
public-close-error=WINDOW_CLOSE_UNVERIFIED
public-close-verified=false
public-close-verification=ax-window-absent-or-changed
public-close-window={"field":"window","value":{"id":"pid:60698:window:0","title":"rumiai-v67-close-handle-B.txt"}}
public-close-current-window={"id":"pid:60698:window:0"}
independent-documents-after=["rumiai-v67-close-handle-A.txt"]
independent-close-attempts=1
independent-physical-close=PASS
after-window-list=PASS
after-window-count=1
after-windows=[{"id":"pid:60698:window:0","title":"rumiai-v67-close-handle-A.txt","process":"TextEdit","pid":60698,"focused":false,"pinned":true}]
survivor-after-handle=pid:60698:window:0
closed-handle-reused-by-survivor=true
close-verifier-consistency=FALSE_NEGATIVE
diagnostic-coherent=PASS
diagnostic-complete=PASS
fixture-cleanup=PASS
runtime-close=PASS
diagnostic_exit=0
```

## Conclusion

- Physical close succeeded.
- Historical verifier returned a false negative.
- `pid:<pid>:window:<index>` cannot be used as durable identity across close because the surviving AX window may reuse the same positional index.
- The v59 postcondition `afterId !== beforeId` is invalid for multi-window close on current macOS/agent-ctrl.
- Production close verification must be corrected before additional window lifecycle actions are added.
