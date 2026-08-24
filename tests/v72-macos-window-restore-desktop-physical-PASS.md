# v72 macOS Window Restore Desktop Plugin Physical — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-restore-desktop-physical-test.js
echo "physical_exit=$?"
```

Exact output:

```text
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
window-list=PASS
window-count=1
windows=[{"id":"pid:63520:window:0","title":"rumiai-v72-desktop-restore.txt","process":"TextEdit","pid":63520,"focused":false,"pinned":true}]
fixture-title=rumiai-v72-desktop-restore.txt
target-window={"id":"pid:63520:window:0","title":"rumiai-v72-desktop-restore.txt","process":"TextEdit","pid":63520,"focused":false,"pinned":true}
restore-fixture-ready=PASS
desktop-application-resolved=PASS
native-before=PASS
native-minimized-before=false
precondition-minimize=PASS
precondition-minimize-state=MINIMIZED
precondition-minimize-verified=true
precondition-minimize-verification=native-ax-minimized-true
native-minimized-precondition=PASS
native-minimized-observed=true
independent-minimized-precondition=PASS
independent-minimized-observed=true
desktop-restore=PASS
desktop-restore-state=RESTORED
desktop-restore-error=
desktop-restore-method=AXWindows exact-title + AXMinimized
desktop-restore-verified=true
desktop-restore-verification=native-ax-minimized-false
desktop-restore-observed-handle=pid:63520:window:0
desktop-restore-action-handle=pid:63520:window:0
desktop-restore-handle-rebound=false
desktop-restore-minimized=false
desktop-restore-restored=true
native-restored-state=PASS
native-restored-observed=false
independent-restored-state=PASS
independent-restored-observed=false
physical-window-restore-desktop=PASS
fixture-restored-state=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

Conclusion: the effective macOS Desktop Plugin physically restored the uniquely titled TextEdit fixture from native AXMinimized=true to false. The plugin reported RESTORED with verified=true and the native-ax-minimized-false marker; an independent System Events observation also reported false. Cleanup and runtime shutdown passed.
