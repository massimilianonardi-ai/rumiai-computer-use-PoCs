# Native Cocoa/AppKit physical validation — FAIL (run 2)

- Date: 2026-08-26
- Host: physical macOS Apple Silicon
- macOS: 26.5.2 (Build 25F84)
- Product SHA: `6af9222748023b6352be408514eb51f6f07dd0b7`
- PoC SHA before evidence: `45ca04f760e2469c936d6d0249b997c697de5322`
- agent-ctrl: `agent-ctrl 0.1.4`
- Swift: `swift-driver version: 1.148.6 Apple Swift version 6.3.3 (swiftlang-6.3.3.1.3 clang-2100.1.1.101)`
- Swift target: `arm64-apple-macosx26.0`
- Fixture: temporary native Cocoa/AppKit application compiled from `tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift`
- Safari/WebKit: not used

The prescribed unsuffixed FAIL evidence file already records run 1 and was preserved unchanged. This run therefore uses the `-FAIL-2.md` suffix so that there remains exactly one evidence file for each physical run without deleting or overwriting prior evidence.

## Exact command

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc

AGENT_CTRL=/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl \
RUMIAI_COMPUTER_CONTROL_ROOT=/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control \
RUMIAI_CC_NODE=/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
  tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

`AGENT_CTRL` was set explicitly to the portable-runtime binary required by the handoff. The command was launched from Finder so that it executed in the physical macOS Accessibility context authorized for this ChatGPT/Codex session.

## Complete harness stdout/stderr

```text
ui.toggle-present=PASS
ui.toggle-awaits-appkit-validation=PASS
ui.select-present=PASS
ui.select-awaits-appkit-validation=PASS
ui.expand-present=PASS
ui.expand-awaits-appkit-validation=PASS
ui.collapse-present=PASS
ui.collapse-awaits-appkit-validation=PASS
ui.setValue-present=PASS
ui.setValue-awaits-appkit-validation=PASS
ui.increment-present=PASS
ui.increment-awaits-appkit-validation=PASS
ui.decrement-present=PASS
ui.decrement-awaits-appkit-validation=PASS
ui.children-present=PASS
ui.children-awaits-appkit-validation=PASS
ui.scroll-present=PASS
ui.scroll-awaits-appkit-validation=PASS
ui.scrollIntoView-present=PASS
ui.scrollIntoView-awaits-appkit-validation=PASS
appkit-checkbox-state=PASS
appkit-toggle=PASS
appkit-toggle-idempotent=PASS
appkit-toggle-restore=PASS
appkit-select=PASS
appkit-select-idempotent=PASS
appkit-slider-numeric=PASS
physical-native-control-appkit=FAIL
Error: Error: act failed: action 'fill' failed: setting AX attribute AXValue failed with kAXErrorIllegalArgument (-25201: argument is not legal for this attribute or action)
    at Socket.<anonymous> (/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control/sdk/typescript/src/index-core.js:122:27)
    at Socket.emit (node:events:514:20)
    at addChunk (node:internal/streams/readable:568:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:519:3)
    at Readable.push (node:internal/streams/readable:399:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)
runner-exit-status=1
```

## Classification

`FAIL`

The native fixture launched and completed the capability checks plus physical checkbox, radio-button, and numeric slider assertions. The first semantic failure occurs while validating `ui.setValue` against the AppKit value-indicator control: the backend dispatches `fill`, and `agent-ctrl` reports that setting `AXValue` is illegal for that AppKit attribute/action.

No corrective code change was made before this evidence file was created and committed.
