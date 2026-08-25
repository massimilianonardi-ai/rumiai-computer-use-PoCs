# v82 macOS Window Control Phase Physical — PASS

Date: 2026-08-25
Platform: macOS ARM64
Status: PASS / PHYSICALLY VALIDATED

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
public-current-window=PASS
public-current-title=rumiai-v82-window-control-A.txt
native-original-bounds={"x":182,"y":83,"width":656,"height":422}
fixture-A-prepared=PASS
public-window-move=PASS
public-window-move-bounds={"x":325,"y":250,"width":620,"height":420}
independent-move-bounds={"x":325,"y":250,"width":620,"height":420}
public-window-resize=PASS
public-window-resize-bounds={"x":325,"y":250,"width":790,"height":545}
independent-resize-bounds={"x":325,"y":250,"width":790,"height":545}
public-window-maximize=PASS
public-window-maximize-bounds={"x":0,"y":34,"width":1710,"height":1014}
independent-maximize-bounds={"x":0,"y":34,"width":1710,"height":1014}
inter-capability-bounds-restore=PASS
public-window-minimize=PASS
independent-minimized=true
public-window-restore=PASS
independent-restored-minimized=false
public-window-refocus-before-close=PASS
public-window-close=PASS
public-window-close-state=CLOSED
public-window-close-verification=window-descriptor-count-decreased
closed-fixture-A-absent=PASS
surviving-fixture-B-present=PASS
physical-macos-window-control-phase=PASS
fixture-A-cleanup=PASS
fixture-B-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

The final effective macOS Desktop Plugin composition physically validated all Window Control capabilities together through the public Computer Control facade. Native or independent state checks confirmed focus/current identity, bounds mutations, minimized state, restoration, and selective close behavior.
