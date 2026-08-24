# v60 macOS Window List Physical PASS

Date: 2026-08-24
Platform: macOS / darwin

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull
./bin/nodejs/bin/node app/window-list-physical-test.js
echo "physical_exit=$?"
```

## Physical result

```text
desktop=macos platform=darwin
runtime-ready=PASS
provider-path=/System/Applications/TextEdit.app
application-resolved=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
window-list=PASS
window-list-state=OBSERVED
window-list-method=agent-ctrl window-list --json
window-count=2
windows=[{"id":"pid:59544:window:0","title":"rumiai-v60-window-B.txt","process":"TextEdit","pid":59544,"focused":false,"pinned":true},{"id":"pid:59544:window:1","title":"rumiai-v60-window-A.txt","process":"TextEdit","pid":59544,"focused":false,"pinned":false}]
fixture-A-listed=PASS
fixture-B-listed=PASS
fixture-distinct-window-ids=PASS
fixture-normalized-fields=PASS
fixture-pinned-window=PASS
physical-window-list=PASS
fixture-cleanup=WARN
runtime-close=PASS
physical_exit=0
```

## Conclusion

PASS.

The macOS Desktop Plugin physically enumerated two real TextEdit windows. Both fixture titles were present, their stable window ids were distinct, normalized fields were populated, and one window was correctly marked pinned. The runtime closed successfully.

`fixture-cleanup=WARN` is recorded exactly as observed. It concerns best-effort test-fixture cleanup and does not invalidate the window-list observation or its verified assertions; the test exited 0.

v60 physical criteria are satisfied.
