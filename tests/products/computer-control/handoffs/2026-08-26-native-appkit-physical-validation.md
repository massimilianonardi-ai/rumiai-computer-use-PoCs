# Work handoff — native Cocoa/AppKit physical validation

Date: 2026-08-26

## Objective

Physically validate RumiAI Computer Control Phase 3–7 on a real macOS Cocoa/AppKit surface.

This is **not** browser validation. Safari/WebKit/HTML/ARIA controls are outside the native-controls milestone and must not be used as substitutes.

## Authoritative baseline

Product repository:

- repository: `massimilianonardi-ai/rumiai-computer-control`
- branch: `main`
- required product HEAD: `a3e38b87fde4e4fb2639f3e867ef45a11c65825b`

PoC repository:

- repository: `massimilianonardi-ai/rumiai-computer-use-PoCs`
- branch: `main`
- AppKit harness baseline is a descendant of `cc1ac5e4bd9e4f8ead1123c045edf5ff24f22ff7`
- boundary evidence before physical execution: `tests/products/computer-control/results/2026-08-26-native-appkit-boundary-PASS.md`

The corrected boundary suite passed with `30 PASS / 0 FAIL` against product commit `a3e38b87fde4e4fb2639f3e867ef45a11c65825b`.

Phase 3–7 capabilities remain `IMPLEMENTED`; do not treat the boundary PASS as physical validation.

## Local portable runtime

Expected paths:

- root: `/Volumes/RumiAI/rumiai-portable-runtime`
- product: `/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control`
- PoC working copy: `/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc`
- Node: `/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node`
- agent-ctrl: `/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl`

Do not install global/profile/system dependencies.

## Preflight

Before any physical result is reported:

1. Update both working copies with fast-forward-only Git operations.
2. Verify the product working copy is exactly `a3e38b87fde4e4fb2639f3e867ef45a11c65825b`.
3. Verify the PoC working copy contains commit `cc1ac5e4bd9e4f8ead1123c045edf5ff24f22ff7` in its ancestry.
4. Verify `/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl` is version `0.1.4`.
5. Verify `/usr/bin/xcrun swiftc` is available.
6. Verify the process executing the test has macOS Accessibility permission. If permission cannot be obtained, report `BLOCKED`; do not convert it into a product FAIL.

Suggested verification:

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control
git fetch origin main
git checkout main
git pull --ff-only
test "$(git rev-parse HEAD)" = "a3e38b87fde4e4fb2639f3e867ef45a11c65825b"

cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc
git fetch origin main
git checkout main
git pull --ff-only
git merge-base --is-ancestor cc1ac5e4bd9e4f8ead1123c045edf5ff24f22ff7 HEAD

/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl --version
/usr/bin/xcrun swiftc --version
```

If an authoritative HEAD does not match, stop and report `BLOCKED` rather than testing a different revision.

## Native fixture

The harness compiles a temporary local Cocoa application using Swift/AppKit. It includes native:

- `NSButton` checkbox;
- `NSButton` radio buttons;
- `NSSlider`;
- `NSStepper`;
- `NSPopUpButton`;
- `NSOutlineView` with deterministic accessible row labels;
- `NSScrollView` with a deep offscreen target.

Source:

```text
tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift
```

Physical harness:

```text
tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

The fixture is built below the temporary directory and removed by the harness. It must not be installed persistently.

## Execute

From the PoC working copy:

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc

RUMIAI_COMPUTER_CONTROL_ROOT=/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control \
RUMIAI_CC_NODE=/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
  tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

Do not replace this run with static inspection or with Safari/WebKit tests.

## Capabilities under physical validation

- Phase 3: `ui.toggle`, `ui.select`
- Phase 4: `ui.expand`, `ui.collapse`
- Phase 5: `ui.setValue`, `ui.increment`, `ui.decrement`
- Phase 6: `ui.children`
- Phase 7: `ui.scroll`, `ui.scrollIntoView`

The harness also checks that these capabilities are still reported as `IMPLEMENTED` before physical promotion.

## Result classification

### PASS

Only report PASS when the harness terminates successfully and prints:

```text
physical-native-control-appkit=PASS
```

Every preceding named check must also be `PASS`.

### FAIL

Use FAIL for an observable product/contract/backend semantic failure on the native AppKit fixture, including a failed postcondition or incorrect API behavior.

Do not fix anything before recording the original failure evidence.

### BLOCKED

Use BLOCKED for environmental inability to execute the physical test faithfully, including unavailable macOS access, missing `/Volumes/RumiAI/rumiai-portable-runtime`, missing local terminal access, missing `xcrun/swiftc`, inability to launch the temporary AppKit application, or missing Accessibility permission that cannot be granted.

Never simulate PASS/FAIL when physical access is unavailable.

## Evidence

Create exactly one result file for each physical run:

```text
tests/products/computer-control/results/2026-08-26-native-appkit-physical-PASS.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-BLOCKED.md
```

Record at minimum:

- product SHA;
- PoC SHA;
- macOS version;
- `agent-ctrl --version`;
- Swift version;
- exact command;
- complete harness stdout/stderr;
- final marker;
- exact failing check/error when applicable.

Commit the evidence before any corrective code change. Suggested messages:

```text
test: record native AppKit physical pass
test: record native AppKit physical fail
test: record native AppKit physical blocked
```

## After FAIL

After the FAIL evidence commit exists, isolate the failing capability and make the smallest targeted product change possible. Keep the capability `IMPLEMENTED`, add/update the matching boundary test if appropriate, rerun boundary CI, then rerun the same physical harness and record a new result without deleting the previous FAIL evidence.

## After PASS

Do not silently rewrite product status from the Work test itself. Return the physical evidence commit SHA. A separate reviewed product commit can then promote only the capabilities actually covered by the successful AppKit evidence to `PHYSICALLY_VALIDATED`.
