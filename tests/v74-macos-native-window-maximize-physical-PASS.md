# v74 macOS Native Window Maximize Physical — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-maximize-native-physical-test.js
echo "physical_exit=$?"
```

Exact output:

```text
native-helper-compile=PASS
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
window-list=PASS
fixture-title=rumiai-v74-native-maximize.txt
fixture-pid=64552
maximize-fixture-ready=PASS
native-observe-before=PASS
native-original-bounds={"height":422,"width":656,"x":182,"y":83}
native-position-settable=true
native-size-settable=true
fixture-prepare-action=PASS
fixture-prepared-native=PASS
fixture-prepared-independent=PASS
fixture-prepared-bounds={"height":320,"width":472,"x":222,"y":123}
native-maximize-action=PASS
native-maximize-method=AXWindows exact-title + AXPosition + AXSize
native-maximize-before={"height":320,"width":472,"x":222,"y":123}
native-maximize-desired={"height":1015,"width":1710,"x":0,"y":34}
native-maximize-after-immediate={"height":1014,"width":1710,"x":0,"y":34}
native-maximize-transition-required=PASS
native-maximized-state=PASS
native-maximized-attempts=1
native-maximized-observed={"height":1014,"width":1710,"x":0,"y":34}
independent-maximized-state=PASS
independent-maximized-attempts=1
independent-maximized-observed={"x":0,"y":34,"width":1710,"height":1014}
physical-window-maximize=PASS
native-restore-bounds-action=PASS
native-restored-bounds=PASS
independent-restored-bounds=PASS
physical-native-window-maximize-primitive=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

Conclusion: the helper physically changed the uniquely titled TextEdit window from prepared bounds to the selected display visible frame within the declared three-pixel tolerance. Native polling and independent System Events observation agreed, original bounds were restored, cleanup passed and the runtime closed normally.
