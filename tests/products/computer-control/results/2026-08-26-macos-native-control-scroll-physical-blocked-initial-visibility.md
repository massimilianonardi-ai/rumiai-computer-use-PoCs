# macOS native control scroll physical validation — BLOCKED (initial visibility)

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@107792a`
- PoC baseline: `massimilianonardi-ai/rumiai-computer-use-PoCs@52a94b5`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-scroll.js`

## Exact result

```text
ui.scroll-capability-present=PASS
ui.scroll-capability-awaits-validation=PASS
ui.scrollIntoView-capability-present=PASS
ui.scrollIntoView-capability-awaits-validation=PASS
scroll-anchor-observed=PASS
offscreen-target-observed=PASS
target-initially-not-visible=FAIL
physical-native-control-scroll=FAIL
Error: target-initially-not-visible
runner-exit-status=1
```

## Blocker

The target was present in Safari's snapshot, but the initial `describe` result did not report `visible=false`; scrolling was not attempted and no promotion was made.
