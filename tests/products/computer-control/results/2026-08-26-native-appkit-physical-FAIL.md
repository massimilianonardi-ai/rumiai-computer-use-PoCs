# Native Cocoa/AppKit physical validation — FAIL

- Date: 2026-08-26
- Host: physical macOS Apple Silicon
- macOS: 26.5.2 (Build 25F84)
- Product SHA: `a3e38b87fde4e4fb2639f3e867ef45a11c65825b`
- PoC SHA before evidence: `798728c9fe60652ba5fb14c82a3eadda46a0bba2`
- agent-ctrl: `agent-ctrl 0.1.4`
- Swift: `swift-driver version: 1.148.6 Apple Swift version 6.3.3 (swiftlang-6.3.3.1.3 clang-2100.1.1.101)`
- Swift target: `arm64-apple-macosx26.0`
- Fixture: temporary native Cocoa/AppKit application compiled from `tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift`
- Safari/WebKit: not used

## Exact command

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc

AGENT_CTRL=/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl \
RUMIAI_COMPUTER_CONTROL_ROOT=/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control \
RUMIAI_CC_NODE=/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
  tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

`AGENT_CTRL` was set explicitly to the portable-runtime binary required by the handoff.

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
physical-native-control-appkit=FAIL
Error: Error: unknown role "radio-button" (expected kebab-case, e.g. `button`, `menu-item`, `text-field`): unknown variant `radio-button`, expected one of `button`, `link`, `text-field`, `checkbox`, `radio`, `combo-box`, `list-box`, `menu-item`, `menu-item-checkbox`, `menu-item-radio`, `option`, `search-box`, `slider`, `spin-button`, `switch`, `tab`, `tree-item`, `heading`, `cell`, `grid-cell`, `column-header`, `row-header`, `list-item`, `article`, `region`, `main`, `navigation`, `generic`, `group`, `list`, `table`, `row`, `row-group`, `grid`, `tree-grid`, `menu`, `menu-bar`, `toolbar`, `tab-list`, `tree`, `document`, `application`, `window`, `dialog`, `app`, `frame`, `image`, `unknown`
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

The native fixture launched and the runtime passed the environment/capability checks. The first semantic failure is the role vocabulary mismatch in `ui.find`: the public canonical role `radio-button` is forwarded to `agent-ctrl 0.1.4`, whose accepted native role is `radio`.

No corrective code change was made before this evidence file was created and committed.
