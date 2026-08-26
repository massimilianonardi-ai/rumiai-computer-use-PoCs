# micro-PoC — Cocoa/AppKit native controls revalidation

Status: **NOT_RUN_PHYSICALLY**

Product baseline under test: `1720411009867b0a6e55fcbca18136e284a572d8` or later descendants containing the native scope, AX toggle, AX JSON children and native scroll corrections.

## Scope

This replaces Safari/HTML as the physical target for the native-controls milestone. The fixture is a real Cocoa/AppKit application built locally in a temporary directory and contains standard `NSButton` checkbox/radio controls, `NSSlider`, `NSStepper`, `NSPopUpButton`, `NSOutlineView` and `NSScrollView` controls.

No application or framework is installed globally. `xcrun swiftc` compiles the fixture into `/tmp`; the test creates a temporary provider through `RUMIAI_PROVIDER_DIR` and removes the fixture on exit.

## Physical test

```sh
node tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

Expected complete marker:

```text
physical-native-control-appkit=PASS
```

The harness exercises Phase 3–7 on native AppKit surfaces and restores mutable state where practical. A missing Swift toolchain or macOS Accessibility permission is `BLOCKED`; an observable semantic/postcondition mismatch is `FAIL`. Record either exact result before modifying product code.

The older Safari physical evidence remains in the repository only as WebKit→AX interoperability history and cannot promote native AppKit capabilities.
