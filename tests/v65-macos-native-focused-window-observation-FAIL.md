# v65 macOS native focused-window observation — physical FAIL

Date: 2026-08-24
Platform: macOS / Apple Silicon

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull

./bin/nodejs/bin/node app/native-focused-window-observation-diagnostic-test.js
echo "diagnostic_exit=$?"
```

## Exact result

```text
native-helper-compile=PASS
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
before-window-list=PASS
before-window-count=2
before-windows=[{"id":"pid:60286:window:0","title":"rumiai-v65-native-focus-B.txt","process":"TextEdit","pid":60286,"focused":false,"pinned":true},{"id":"pid:60286:window:1","title":"rumiai-v65-native-focus-A.txt","process":"TextEdit","pid":60286,"focused":false,"pinned":false}]
fixture-window-count=2
initial-pinned-title=rumiai-v65-native-focus-B.txt
initial-pinned-id=pid:60286:window:0
target-title=rumiai-v65-native-focus-A.txt
target-id=pid:60286:window:1
native-focus-fixture-ready=PASS
native-focused-before=FAIL
native-focused-before-data={"axError":-25204,"error":"FOCUSED_APPLICATION_UNAVAILABLE","ok":false}
native-focused-before-error={"axError":-25204,"error":"FOCUSED_APPLICATION_UNAVAILABLE","ok":false}
fixture-cleanup=WARN
runtime-close=PASS
diagnostic_exit=1
```

## Classification

PHYSICAL FAIL.

The native helper compiled successfully and the runtime/fixtures/window enumeration were valid. Failure is isolated to the helper's attempt to obtain the focused application through the system-wide AX object. No production code was changed by v65.

Per project process, this FAIL is committed before diagnosis or correction.
