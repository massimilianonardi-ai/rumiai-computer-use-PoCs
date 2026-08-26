# macOS native control children physical validation — BLOCKED (direct child)

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@107792a`
- PoC baseline: `massimilianonardi-ai/rumiai-computer-use-PoCs@64fdc2d`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-children.js`

## Exact result

```text
parent-observed=PASS
children-observed=PASS
children-bounded=PASS
direct-child-observed=FAIL
physical-native-control-children=BLOCKED
Error: direct-child-observed
runner-exit-status=1
```

## Blocker

Safari exposed the treeitem target, and `ui.children` returned a bounded observation, but the harness did not observe the expected nested child name in the returned direct-child page. No capability promotion was made.
