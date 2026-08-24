# v61 macOS Window List Facade Physical PASS

Date: 2026-08-24
Platform: macOS (darwin)
Result: PASS

Command executed:

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull

./bin/nodejs/bin/node app/window-list-facade-physical-test.js
echo "physical_exit=$?"
```

Observed output:

```text
desktop=macos platform=darwin
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
facade-window-list=PASS
facade-window-list-state=OBSERVED
facade-window-list-method=agent-ctrl window-list --json
facade-window-count=2
facade-windows=[{"id":"pid:59833:window:0","title":"rumiai-v61-window-B.txt","process":"TextEdit","pid":59833,"focused":false,"pinned":true},{"id":"pid:59833:window:1","title":"rumiai-v61-window-A.txt","process":"TextEdit","pid":59833,"focused":false,"pinned":false}]
fixture-A-listed-through-facade=PASS
fixture-B-listed-through-facade=PASS
fixture-distinct-window-ids=PASS
fixture-normalized-fields=PASS
fixture-pinned-window=PASS
physical-window-list-facade=PASS
fixture-cleanup=WARN
runtime-close=PASS
physical_exit=0
```

Validation:
- Public `ComputerControl.listWindows({app:"TextEdit"})` physically enumerated two real TextEdit windows.
- Both fixture windows were returned through the public facade.
- Window ids were distinct.
- Normalized fields were preserved: id, title, process, pid, focused, pinned.
- At least one window was pinned.
- Runtime cleanup passed.
- `fixture-cleanup=WARN` is recorded exactly and did not affect the validated observation path or exit status.

Conclusion: v61 physical facade behavior PASS.
