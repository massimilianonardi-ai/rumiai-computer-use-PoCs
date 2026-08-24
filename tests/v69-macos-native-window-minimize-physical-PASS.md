# v69 macOS native window minimize primitive physical PASS

Exact physical test result reported on macOS:

```text
native-helper-compile=PASS
runtime-ready=PASS
fixture-open=PASS
application-ready=PASS
window-list=PASS
window-count=1
fixture-title=rumiai-v69-native-minimize.txt
fixture-pid=60845
minimize-fixture-ready=PASS
native-observe-before=PASS
native-minimized-before=false
native-settable=true
independent-before=PASS
independent-minimized-before=false
native-minimize-action=PASS
native-minimize-method=AXWindows exact-title + AXMinimized
native-minimize-before=false
native-minimize-after-immediate=false
native-minimized-state=PASS
native-minimized-attempts=1
native-minimized-observed=true
independent-minimized-state=PASS
independent-minimized-attempts=1
independent-minimized-observed=true
physical-window-minimize=PASS
native-restore-action=PASS
native-restore-before=true
native-restore-after-immediate=true
native-restored-state=PASS
native-restored-attempts=1
native-restored-observed=false
independent-restored-state=PASS
independent-restored-attempts=1
independent-restored-observed=false
physical-window-restore=PASS
physical-native-window-minimize-primitive=PASS
fixture-cleanup=PASS
runtime-close=PASS
physical_exit=0
```

Classification: PASS.

The native AX primitive physically minimized the TextEdit fixture (`AXMinimized false -> true`) and restored it (`true -> false`). Both transitions were independently observed and matched the native helper result.
