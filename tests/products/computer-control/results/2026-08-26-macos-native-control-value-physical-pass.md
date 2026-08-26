# macOS native control value physical validation — PASS

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@efaa208`
- PoC baseline: `massimilianonardi-ai/rumiai-computer-use-PoCs@952ff63`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-value.js`
- Fixture: native Safari slider control.
- Protocol: observe → act → reobserve → verify postcondition.

## Exact result

```text
slider-observed=PASS
slider-numeric-value=PASS
set-value-verified=PASS
set-value-idempotent=PASS
increment-direction=PASS
decrement-direction=PASS
value-restored=PASS
physical-native-control-value=PASS
runner-exit-status=0
```

## Validated slice

- `ui.setValue`: numeric value write, postcondition verification and idempotence were physically observed.
- `ui.increment`: numeric value increased after the action.
- `ui.decrement`: numeric value decreased after the action.
- The fixture value was restored after the test.
