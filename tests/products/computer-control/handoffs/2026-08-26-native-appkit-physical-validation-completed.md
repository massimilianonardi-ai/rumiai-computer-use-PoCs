# Work handoff — native Cocoa/AppKit physical validation completed

Date: 2026-08-26

## Outcome

The native Cocoa/AppKit physical validation requested by
`tests/products/computer-control/handoffs/2026-08-26-native-appkit-physical-validation.md`
is complete with final classification **PASS**.

The ninth physical run terminated with status `0`, every named check was `PASS`,
and the required final marker was:

```text
physical-native-control-appkit=PASS
```

This was a real physical macOS Accessibility run against a temporary native
Cocoa/AppKit application. Safari, WebKit, HTML, and ARIA controls were not used
as substitutes and no result was simulated.

## Authoritative final state

Product repository:

- repository: `massimilianonardi-ai/rumiai-computer-control`
- branch: `main`
- final HEAD: `ea4a7f0bc190aa8d836ec2f123e0c1d0e470c4e1`
- remote `origin/main`: same SHA
- working tree at handoff creation: clean

PoC and evidence repository:

- repository: `massimilianonardi-ai/rumiai-computer-use-PoCs`
- branch: `main`
- validation-completion HEAD before this handoff document: `2334690a069d65ebd5546508f447c39f10d3cd8f`
- physical PASS evidence commit: `2334690a069d65ebd5546508f447c39f10d3cd8f`
- working tree before this handoff document: clean

Validated revisions recorded by the PASS evidence:

- product: `ea4a7f0bc190aa8d836ec2f123e0c1d0e470c4e1`
- PoC before the evidence commit: `28337b608e29f85a09e9bb75b05dfcbb92ce4c09`

Authoritative result:

```text
tests/products/computer-control/results/2026-08-26-native-appkit-physical-PASS.md
```

The complete stdout/stderr, exact command, environment versions, validated
SHAs, and result classification are recorded in that file.

## Physical environment

- host: physical Apple Silicon Mac
- macOS: `26.5.2` build `25F84`
- agent-ctrl: `0.1.4`
- Swift: Apple Swift `6.3.3`
- Swift target: `arm64-apple-macosx26.0`
- portable-runtime root: `/Volumes/RumiAI/rumiai-portable-runtime`
- product checkout: `/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control`
- PoC checkout: `/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc`
- Node: `/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node`
- agent-ctrl: `/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl`

The physical command was launched through the Finder/macOS application context
authorized for Accessibility access in the ChatGPT/Codex session.

## Final validation command

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc

AGENT_CTRL=/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl \
RUMIAI_COMPUTER_CONTROL_ROOT=/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control \
RUMIAI_CC_NODE=/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node \
  tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

Fixture source:

```text
tests/products/computer-control/fixtures/macos-appkit-native-controls/main.swift
```

Physical harness:

```text
tests/products/computer-control/physical-tests/macos-native-control-appkit.js
```

## Physically validated behavior

The successful run covered:

- Phase 3: `ui.toggle` and `ui.select`, including idempotence and state restore;
- Phase 4: `ui.expand` and `ui.collapse`, including idempotence;
- Phase 5: `ui.setValue`, `ui.increment`, and `ui.decrement` on native numeric controls;
- Phase 6: `ui.children`, including parent, direct-child, and bounded-depth behavior;
- Phase 7: `ui.scroll` and verified `ui.scrollIntoView` on a deep offscreen target;
- AppKit checkbox, radio/select, slider, stepper, outline/disclosure, nested native
  groups, scroll container, and deep target postconditions;
- presence of all public APIs and their promise-based AppKit validation contract.

Final physical checks:

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

## Automated verification

- local product contract suite: `39 PASS / 0 FAIL`
- structure validation: PASS
- final GitHub Actions `product-tests` run: `33009091262` — PASS
- CI URL: `https://github.com/massimilianonardi-ai/rumiai-computer-use-PoCs/actions/runs/33009091262`
- CI tested PoC `28337b608e29f85a09e9bb75b05dfcbb92ce4c09`
  against product `ea4a7f0bc190aa8d836ec2f123e0c1d0e470c4e1`

## Failure-first development record

Eight physical failures were preserved and committed before their corresponding
fixes. Do not delete or rewrite these files; together they form the audit trail
required by the original handoff.

| Run | Evidence commit | Observed cause | Product correction | Regression coverage |
| --- | --- | --- | --- | --- |
| 1 | `1ba2f6a` | Public role `radio-button` was forwarded to agent-ctrl, which expects `radio`. | `04b5ea8`, refined by `6af9222` | `027eb42`, portable form `45ca04f`; CI `32979873388` PASS |
| 2 | `1b25e26` | Numeric slider `setValue` used text fill, illegal for the AppKit AX value. | `b4e68e4` | `1393645`; CI `32980433980` PASS |
| 3 | `1b118d0` | The fixture placed the outline row label on an accessibility-unobservable row view. | Fixture/harness correction in `c621be0` | CI `32981657886` PASS |
| 4 | `1b48f09` | JSON snapshot wrapper sent unsupported `--depth` to agent-ctrl `0.1.4`. | `114d5a4` | `3d32f50`; CI `32981967791` PASS |
| 5 | `650dba4` | Native `NSScrollView` appeared as an AX group with slider child rather than `scroll-area`. | `7f5c6ba` | `4886e54`; CI `32982267036` PASS |
| 6 | `41544be` | Semantic down-scroll mapped to a positive native content delta and did not move from the top. | `56b6052` | `eab8e6a`; CI `32982658571` PASS |
| 7 | `78413b2` | `AXScrollToVisible` was unsupported for the deep AppKit button. | Wheel-and-geometry fallback in `a01ff80` | `80f217b`; CI `32983092221` PASS |
| 8 | `98347f0` | The fallback accepted a pivot whose frame barely intersected the viewport while its center was outside it. | Require the pivot center to remain inside the viewport in `ea4a7f0` | `28337b6`; CI `33009091262` PASS |

Preserved evidence files:

```text
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-2.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-3.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-4.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-5.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-6.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-7.md
tests/products/computer-control/results/2026-08-26-native-appkit-physical-FAIL-8.md
```

## Product commits introduced by this validation

In chronological order:

```text
04b5ea8 fix: translate native radio find role
6af9222 refactor: expose native find role translation
b4e68e4 fix: set native numeric controls by keyboard
114d5a4 fix: keep native JSON snapshots agent-ctrl compatible
7f5c6ba fix: recognize native AppKit scroll groups
56b6052 fix: map semantic scroll direction to native delta
a01ff80 fix: fall back when native scroll-to-visible is unsupported
ea4a7f0 fix: keep scroll fallback pivot inside viewport
```

## Status and next action

The requested development and physical validation are complete. There is no
remaining fix or mandatory rerun for this handoff.

The covered capabilities deliberately remain reported as `IMPLEMENTED`, exactly
as required by the original instructions. The physical Work/Codex session did
not silently alter product status metadata.

The only optional follow-up is a separate, reviewed product change that promotes
only the capabilities covered by the PASS evidence to `PHYSICALLY_VALIDATED`.
If another session performs that promotion, it must:

1. start from product commit `ea4a7f0bc190aa8d836ec2f123e0c1d0e470c4e1`;
2. cite PoC evidence commit `2334690a069d65ebd5546508f447c39f10d3cd8f`;
3. change only the status metadata for the capabilities proved by this run;
4. run the product contract and structure suites;
5. create a distinct reviewed commit rather than amending the physical evidence.

Do not reinterpret the earlier FAIL files as current failures: they are immutable
historical evidence. The authoritative terminal result is the committed PASS
file and evidence SHA listed above.
