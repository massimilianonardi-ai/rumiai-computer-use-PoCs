# macOS native control scroll physical validation — PARTIAL

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@107792a`
- PoC baseline: `massimilianonardi-ai/rumiai-computer-use-PoCs@de627d3`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-scroll.js`

## Exact result

```text
ui.scroll-capability-present=PASS
ui.scroll-capability-awaits-validation=PASS
ui.scrollIntoView-capability-present=PASS
ui.scrollIntoView-capability-awaits-validation=PASS
scroll-anchor-observed=PASS
offscreen-target-observed=PASS
target-bounds-offscreen=PASS
scroll-postcondition=PASS
scroll-into-view-postcondition=FAIL
physical-native-control-scroll=FAIL
Error: scroll-into-view-postcondition
runner-exit-status=1
```

## Validated slice and blocker

- `ui.scroll`: physically verified that a PageDown action produced an observable Accessibility snapshot change.
- `ui.scrollIntoView`: not promoted. Safari's visibility state remains `true` for the off-screen target, so the implementation takes its idempotent-visible branch instead of proving a scroll-into-view change.
