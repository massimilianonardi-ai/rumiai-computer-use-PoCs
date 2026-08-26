# macOS native control disclosure physical validation with ARIA tree — BLOCKED

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@63b77eb`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@da09f27`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-disclosure.js`
- Fixture change under test: the disclosure `treeitem` was nested under an explicit ARIA `tree`.

## Exact result

```text
disclosure-target-observed=FAIL
physical-native-control-disclosure=BLOCKED
Error: disclosure-target-observed
    at check (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-disclosure.js:5:80)
    at main (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-disclosure.js:6:1212)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
runner-exit-status=1
```

## Classification

The valid ARIA tree wrapper did not make the expected `tree-item` role observable through the physical Safari AX snapshot. No further fixture or product change was attempted before recording this evidence.
