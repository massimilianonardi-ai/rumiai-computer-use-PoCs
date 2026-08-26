# macOS native control disclosure physical validation — BLOCKED

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@63b77eb`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@3022033`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-disclosure.js`
- Launch path: Finder opened the single-purpose runner outside the Codex shell sandbox; stdout and exit status were captured in `/private/tmp/rumiai-physical-disclosure.log`.

## Exact result

```text
disclosure-target-observed=FAIL
physical-native-control-disclosure=BLOCKED
Error: disclosure-target-observed
    at check (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-disclosure.js:5:80)
    at main (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-disclosure.js:6:1155)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
runner-exit-status=1
```

## Classification

The physical execution path and AX daemon startup succeeded. Validation stopped before `ui.expand` or `ui.collapse` because the expected disclosure target was not present under the role/name matcher used by the harness. No diagnosis or fix was attempted before recording this evidence.
