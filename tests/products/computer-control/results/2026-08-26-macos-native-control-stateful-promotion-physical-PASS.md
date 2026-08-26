# macOS native control stateful promotion confirmation — PASS

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@63b77eb`
- PoC baseline: `massimilianonardi-ai/rumiai-computer-use-PoCs@0aa95c2`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-stateful.js`
- Protocol: observe → act → reobserve → verify postcondition.

## Exact result

```text
ui.toggle-capability-present=PASS
ui.toggle-capability-physically-validated=PASS
ui.select-capability-present=PASS
ui.select-capability-physically-validated=PASS
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

The promoted capability metadata and the underlying physical behavior were observed together in the same run.
