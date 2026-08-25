# v82 macOS Window Control Phase Physical — FAIL

Date: 2026-08-25

```text
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
public-window-list=PASS
public-window-count=2
fixture-A-descriptor={"id":"pid:64552:window:1","title":"rumiai-v82-window-control-A.txt","process":"TextEdit","pid":64552,"focused":false,"pinned":false}
fixture-B-descriptor={"id":"pid:64552:window:0","title":"rumiai-v82-window-control-B.txt","process":"TextEdit","pid":64552,"focused":false,"pinned":true}
complete-distinct-descriptors=PASS
public-window-focus=PASS
public-window-focus-verification=native-focused-window-descriptor
public-current-window=FAIL
public-current-title=
fixture-A-cleanup=WARN
fixture-B-cleanup=PASS
runtime-close=PASS
physical_exit=1
```

The integrated regression stopped after verified focus because public current-window observation failed. Diagnosis is intentionally deferred until this exact result is committed.
