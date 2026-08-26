# macOS native control disclosure physical validation — PASS

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@bbb834b`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@e1b31ad`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-disclosure.js`
- Fixture: native `<button aria-expanded>` control, observed by Safari AX as `button`.
- Protocol: observe → act → reobserve → verify postcondition.

## Exact result

```text
disclosure-target-observed=PASS
expanded-state-observable=PASS
expand-postcondition=PASS
expand-idempotent=PASS
collapse-postcondition=PASS
physical-native-control-disclosure=PASS
runner-exit-status=0
```

## Validated slice

- `ui.expand`: verified `expanded=true` postcondition and idempotence were physically observed.
- `ui.collapse`: verified `expanded=false` postcondition was physically observed.
