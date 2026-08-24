# v71 macOS Window Minimize Public Facade Physical — PASS

Date: 2026-08-25
Platform: macOS ARM64
Commit under test: `4ea1a47`

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
./bin/nodejs/bin/node app/window-minimize-facade-physical-test.js
echo "physical_exit=$?"
```

## Exact result

```text
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
facade-window-list=PASS
facade-window-count=1
facade-windows=[{"id":"pid:63520:window:0","title":"rumiai-v71-facade-minimize.txt","process":"TextEdit","pid":63520,"focused":false,"pinned":true}]
fixture-title=rumiai-v71-facade-minimize.txt
target-window={"id":"pid:63520:window:0","title":"rumiai-v71-facade-minimize.txt","process":"TextEdit","pid":63520,"focused":false,"pinned":true}
minimize-fixture-ready=PASS
native-before=PASS
native-minimized-before=false
facade-window-minimize=PASS
facade-window-minimize-state=MINIMIZED
facade-window-minimize-error=
facade-window-minimize-method=AXWindows exact-title + AXMinimized
facade-window-minimize-verified=true
facade-window-minimize-verification=native-ax-minimized-true
facade-window-minimize-observed-handle=pid:63520:window:0
facade-window-minimize-action-handle=pid:63520:window:0
facade-window-minimize-handle-rebound=false
facade-window-minimize-minimized=true
facade-minimized-window={"title":"rumiai-v71-facade-minimize.txt","process":"TextEdit","pid":63520}
native-minimized-state=PASS
native-minimized-observed=true
independent-minimized-state=PASS
independent-minimized-observed=true
facade-minimize-postcondition=PASS
physical-window-minimize-facade=PASS
fixture-restore-action=PASS
fixture-restored-state=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

## Classification

- Runtime initialization: PASS
- Fixture creation and application readiness: PASS
- Public facade window listing and full descriptor selection: PASS
- Native pre-action minimized observation: PASS
- Public `ComputerControl.minimizeWindow({app, window})`: PASS
- Facade `MINIMIZED`, `minimized=true`, `verified=true`: PASS
- Native state-driven minimized verification: PASS
- Independent System Events minimized verification: PASS
- Fixture restore action and verification: PASS
- Fixture cleanup: PASS
- Runtime cleanup: PASS

Classification: **PASS**.

The public facade physically preserves the validated v70 safe targeting and native verification contract without exposing backend-specific action logic.
