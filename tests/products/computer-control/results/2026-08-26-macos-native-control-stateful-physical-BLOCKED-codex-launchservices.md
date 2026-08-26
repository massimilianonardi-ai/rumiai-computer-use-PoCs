# Native stateful controls — physical BLOCKED (Codex LaunchServices)

Result: **BLOCKED**

Product commit: `6ef8634fb3db6098438f33c0bf906549945f1348`
PoC commit tested: `263e34dad194b14587695ce6e44f6f3b7eeacdb8`
Environment: macOS 26.5.2 arm64, Node.js `v26.7.0`, `agent-ctrl 0.1.4`
Executor: local ChatGPT/Codex task with per-step sandbox approval

Command:

```sh
"/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node" \
  tests/products/computer-control/physical-tests/macos-native-control-stateful.js
```

Exact observed output:

```text
physical-native-control-stateful=BLOCKED
Error: could not open Safari fixture
    at main (/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc/tests/products/computer-control/physical-tests/macos-native-control-stateful.js:66:36)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

The harness stopped at `/usr/bin/open -a Safari <fixture>` before any
Computer Control stateful operation was attempted. This result is an execution
environment block, not a semantic FAIL for `ui.toggle` or `ui.select`.

