# macOS native control stateful physical validation — BLOCKED

- Date: 2026-08-26
- Host: physical macOS (Apple Silicon)
- Product baseline: `massimilianonardi-ai/rumiai-computer-control@194bbedd7a3c28d57224d4a03d4e5709cd184824`
- PoC baseline before this evidence: `massimilianonardi-ai/rumiai-computer-use-PoCs@f7c2a8dd84aabd088eeac9db5fe89d857b166c7d`
- Harness: `tests/products/computer-control/physical-tests/macos-native-control-stateful.js`
- Launch path: Finder opened the single-purpose runner outside the Codex shell sandbox; stdout and exit status were captured in `/private/tmp/rumiai-physical-stateful.log`.

## Exact result

```text
ui.toggle-capability-present=PASS
ui.toggle-capability-awaits-validation=PASS
ui.select-capability-present=PASS
ui.select-capability-awaits-validation=PASS
fixture-checkbox-observed=PASS
fixture-radio-observed=PASS
checkbox-state-observable=FAIL
physical-native-control-stateful=BLOCKED
Error: checkbox-state-observable
    at check (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-stateful.js:17:25)
    at main (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-stateful.js:83:5)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
runner-exit-status=1
```

## Classification

The physical execution path, AX daemon startup, checkbox discovery, and canonical radio discovery succeeded. Validation stopped before mutation because `ui.describe` did not expose a boolean `checked` state for the observed checkbox. The harness emitted `BLOCKED`; no diagnosis or fix of the state mapping was attempted before recording this evidence.
