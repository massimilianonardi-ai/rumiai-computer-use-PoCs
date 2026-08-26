# Native Cocoa/AppKit physical validation — FAIL (run 4)

- Date: 2026-08-26
- Host: physical macOS Apple Silicon
- macOS: 26.5.2 (Build 25F84)
- Product SHA: `b4e68e487bdbd29e323a9ba281f5751b5c4fc1ed`
- PoC SHA before evidence: `c621be0959179d83cbce012110d8d864c964ff14`
- agent-ctrl: `agent-ctrl 0.1.4`
- Swift: `swift-driver version: 1.148.6 Apple Swift version 6.3.3 (swiftlang-6.3.3.1.3 clang-2100.1.1.101)`
- Swift target: `arm64-apple-macosx26.0`
- Fixture: temporary native Cocoa/AppKit application compiled from `tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift`
- Safari/WebKit: not used

The earlier FAIL evidence files were preserved unchanged. This run uses the `-FAIL-4.md` suffix so that there remains exactly one evidence file for each physical run.

## Exact command

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc

AGENT_CTRL=/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl \
RUMIAI_COMPUTER_CONTROL_ROOT=/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control \
RUMIAI_CC_NODE=/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
  tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

`AGENT_CTRL` was set explicitly to the portable-runtime binary required by the handoff. The command was launched from Finder in the physical macOS Accessibility context authorized for this ChatGPT/Codex session.

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
appkit-set-value=PASS
appkit-increment=PASS
appkit-decrement=PASS
appkit-outline-row-label=PASS
appkit-disclosure-state=PASS
appkit-expand=PASS
appkit-expand-idempotent=PASS
appkit-children-parent=PASS
physical-native-control-appkit=FAIL
Error: no target process produced JSON AX snapshot
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

The native fixture launched and physically passed checkbox, radio-button, numeric value, outline-row discovery, disclosure expansion, and disclosure idempotence assertions. The first remaining failure occurs in `ui.children`: the product requests a JSON Accessibility snapshot with a `--depth` argument, but `agent-ctrl 0.1.4` does not support that CLI option and the wrapper reports `no target process produced JSON AX snapshot`.

No corrective code change was made before this evidence file was created and committed.
