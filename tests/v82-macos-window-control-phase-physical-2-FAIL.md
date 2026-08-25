# v82 macOS Window Control Phase Physical (Second Run) — FAIL

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
public-current-title=rumiai-v82-window-control-B.txt
fixture-A-cleanup=WARN
fixture-B-cleanup=PASS
fixture-A-cleanup-detail=90:123: execution error: TextEdit ha trovato un errore: Impossibile ottenere item 2 of every document. Indice non valido. (-1719)
runtime-close=PASS
physical_exit=1
```

The public focus operation physically verified fixture A, but the immediately following public current-window observation returned fixture B. Diagnosis is intentionally deferred until this exact result is committed.
