# Native Cocoa/AppKit physical validation — PASS

- Date: 2026-08-26
- Host: physical macOS Apple Silicon
- macOS: 26.5.2 (Build 25F84)
- Product SHA: `ea4a7f0bc190aa8d836ec2f123e0c1d0e470c4e1`
- PoC SHA before evidence: `28337b608e29f85a09e9bb75b05dfcbb92ce4c09`
- Boundary CI: `product-tests` run `33009091262` — PASS
- agent-ctrl: `agent-ctrl 0.1.4`
- Swift: `swift-driver version: 1.148.6 Apple Swift version 6.3.3 (swiftlang-6.3.3.1.3 clang-2100.1.1.101)`
- Swift target: `arm64-apple-macosx26.0`
- Fixture: temporary native Cocoa/AppKit application compiled from `tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift`
- Safari/WebKit: not used

This is the ninth physical run. All eight preceding FAIL evidence files remain preserved unchanged.

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
appkit-children-direct=PASS
appkit-children-depth=PASS
appkit-collapse=PASS
appkit-scroll=PASS
appkit-scroll-into-view=PASS
physical-native-control-appkit=PASS
runner-exit-status=0
```

## Classification

`PASS`

The harness terminated successfully, printed the required final marker, and every preceding named check was `PASS`. The run physically validated the native Cocoa/AppKit behavior covered by Phase 3–7: toggle/select, expand/collapse, set/increment/decrement numeric values, bounded native children, target-aware scroll, and verified scroll into view.

Capability statuses remain `IMPLEMENTED` as required by the handoff. Promotion to `PHYSICALLY_VALIDATED` is intentionally deferred to a separate reviewed product commit.
