# RumiAI Computer Control micro-PoC v65
## Native focused-window observation — macOS physical PASS

Date: 2026-08-24
Classification: PHYSICAL PASS

The native helper compiled and correctly observed the actual TextEdit focused window before and after a real window-focus action. The native observation matched the independent TextEdit front-document check both before and after focus.

Important diagnostic finding:
- `AXIdentifier` was `_NS:34` before focus on window B and remained `_NS:34` after focus on window A.
- `AXWindowNumber` was absent.
- Therefore neither observed field is usable here as a durable per-window identity.
- The native AX focused-window observation is useful as a postcondition observer, but it does not provide a stronger persistent identity than the rebinding agent-ctrl handle.

Exact physical output:

```text
native-helper-compile=PASS
runtime-ready=PASS
fixture-A-open=PASS
fixture-B-open=PASS
application-ready=PASS
before-window-list=PASS
before-window-count=2
before-windows=[{"id":"pid:60394:window:0","title":"rumiai-v65-native-focus-B.txt","process":"TextEdit","pid":60394,"focused":false,"pinned":true},{"id":"pid:60394:window:1","title":"rumiai-v65-native-focus-A.txt","process":"TextEdit","pid":60394,"focused":false,"pinned":false}]
fixture-window-count=2
initial-pinned-title=rumiai-v65-native-focus-B.txt
initial-pinned-id=pid:60394:window:0
target-title=rumiai-v65-native-focus-A.txt
target-id=pid:60394:window:1
native-focus-fixture-ready=PASS
native-focused-before=PASS
native-focused-before-data={"bundle":"com.apple.TextEdit","identifier":"_NS:34","method":"NSWorkspace.frontmostApplication + AXFocusedWindow","ok":true,"pid":60394,"process":"TextEdit","role":"AXWindow","subrole":"AXStandardWindow","title":"rumiai-v65-native-focus-B.txt","windowNumber":null}
independent-front-document-before=rumiai-v65-native-focus-B.txt
native-before-independent-match=PASS
focus-action=PASS
focus-action-state=FOCUSED
focus-action-verified=true
focus-action-window={"id":"pid:60394:window:1","title":"rumiai-v65-native-focus-B.txt","process":"TextEdit","pid":60394,"focused":false,"pinned":true}
native-focused-after=PASS
native-focused-after-attempts=1
native-focused-after-data={"bundle":"com.apple.TextEdit","identifier":"_NS:34","method":"NSWorkspace.frontmostApplication + AXFocusedWindow","ok":true,"pid":60394,"process":"TextEdit","role":"AXWindow","subrole":"AXStandardWindow","title":"rumiai-v65-native-focus-A.txt","windowNumber":null}
native-focused-target-match=PASS
native-focused-identifier=_NS:34
native-focused-window-number=ABSENT
independent-front-document-after=rumiai-v65-native-focus-A.txt
independent-focus-verification=PASS
diagnostic-complete=PASS
fixture-cleanup=WARN
runtime-close=PASS
diagnostic_exit=0
```

Authoritative result:
- native focused-window observation = PASS
- native observation agrees with independent physical verification = PASS
- AXIdentifier is not unique across these two TextEdit windows
- AXWindowNumber unavailable
- fixture-cleanup=WARN is test-only cleanup behavior and does not invalidate the diagnostic PASS
