# macOS native control stateful physical validation — PASS

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@fb4f768`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@3ef7c8d`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-stateful.js`
- Launch path: Finder opened the single-purpose runner outside the Codex shell sandbox; stdout and exit status were captured in `/private/tmp/rumiai-physical-stateful.log`.
- Protocol: observe → act → reobserve → verify postcondition.

## Exact result

```text
ui.toggle-capability-present=PASS
ui.toggle-capability-awaits-validation=PASS
ui.select-capability-present=PASS
ui.select-capability-awaits-validation=PASS
fixture-checkbox-observed=PASS
fixture-radio-observed=PASS
checkbox-state-observable=PASS
toggle-verified=PASS
toggle-idempotent=PASS
toggle-restored=PASS
radio-selected-state-observable=PASS
select-verified=PASS
select-idempotent=PASS
physical-native-control-stateful=PASS
runner-exit-status=0
```

## Validated slice

- `ui.toggle`: explicit target state, verified checked postcondition, idempotence, and restoration were physically observed.
- `ui.select`: verified selected postcondition and idempotence were physically observed.
