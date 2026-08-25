# v73 macOS Window Restore Public Facade Physical — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-restore-facade-physical-test.js
echo "physical_exit=$?"
```

Exact output:

```text
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
facade-window-list=PASS
facade-window-count=1
facade-windows=[{"id":"pid:64552:window:0","title":"rumiai-v73-facade-restore.txt","process":"TextEdit","pid":64552,"focused":false,"pinned":true}]
fixture-title=rumiai-v73-facade-restore.txt
target-window={"id":"pid:64552:window:0","title":"rumiai-v73-facade-restore.txt","process":"TextEdit","pid":64552,"focused":false,"pinned":true}
restore-fixture-ready=PASS
native-before=PASS
native-minimized-before=false
facade-precondition-minimize=PASS
facade-precondition-minimize-state=MINIMIZED
facade-precondition-minimize-verified=true
facade-precondition-minimize-verification=native-ax-minimized-true
native-minimized-precondition=PASS
native-minimized-observed=true
independent-minimized-precondition=PASS
independent-minimized-observed=true
facade-window-restore=PASS
facade-window-restore-state=RESTORED
facade-window-restore-error=
facade-window-restore-method=AXWindows exact-title + AXMinimized
facade-window-restore-verified=true
facade-window-restore-verification=native-ax-minimized-false
facade-window-restore-observed-handle=pid:64552:window:0
facade-window-restore-action-handle=pid:64552:window:0
facade-window-restore-handle-rebound=false
facade-window-restore-minimized=false
facade-window-restore-restored=true
facade-restored-window={"title":"rumiai-v73-facade-restore.txt","process":"TextEdit","pid":64552}
native-restored-state=PASS
native-restored-observed=false
independent-restored-state=PASS
independent-restored-observed=false
facade-restore-postcondition=PASS
physical-window-restore-facade=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

Conclusion: public ComputerControl.restoreWindow physically restored the uniquely titled TextEdit fixture from native AXMinimized=true to false. The facade returned RESTORED, restored=true, minimized=false and verified=true with the native-ax-minimized-false verification marker. Independent observation, cleanup and runtime shutdown passed.
