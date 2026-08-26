# macOS native control stateful physical validation — BLOCKED

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@6ef8634fb3db6098438f33c0bf906549945f1348`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@1da4df6236637d63ea27099e52d7baba97981c78`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-stateful.js`
- Launch path: Finder opened a single-purpose `.command` runner outside the Codex shell sandbox; stdout and exit status were captured in `/private/tmp/rumiai-physical-stateful.log`.
- Accessibility: `agent-ctrl` was explicitly present and enabled in macOS Privacy & Security > Accessibility.

## Exact result

```text
ui.toggle-capability-present=PASS
ui.toggle-capability-awaits-validation=PASS
ui.select-capability-present=PASS
ui.select-capability-awaits-validation=PASS
fixture-checkbox-observed=PASS
fixture-radio-observed=FAIL
physical-native-control-stateful=BLOCKED
Error: fixture-radio-observed
    at check (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-stateful.js:17:25)
    at main (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-stateful.js:80:5)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
runner-exit-status=1
```

## Classification

The physical execution path and AX daemon startup succeeded. Validation stopped before either stateful action because the expected radio fixture was not present in the observed snapshot. The harness emitted `BLOCKED`; no product diagnosis or fix was attempted before recording this evidence.
