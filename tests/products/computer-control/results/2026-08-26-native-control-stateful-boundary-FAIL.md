# Stateful native controls — boundary result

Result: **FAIL**

Product commit: `35f3be07914faeae133237b566d6ae4bd0d79557`
PoC commit: `4637125af969f5a257d207bbf669befeb694f377`
GitHub Actions run: `32946412098`

Exact summary:

```text
Computer Use boundary: PASS
Computer Control structure: PASS
Computer Control contract: FAIL
17 tests
15 pass
2 fail
```

Failing checks:

```text
SDK and RumiAI adapter expose the canonical operation
invoke schemas, SDK and RumiAI adapter expose the canonical operation
```

Observed cause in the test output: the public SDK wrapper inherited the already validated `describe` and `invoke` methods from `index-core.js`, so runtime behavior remained available, but the existing boundary tests require those method definitions to remain directly observable in `sdk/typescript/src/index.js`. The fix must preserve that public source surface while adding the new methods.

No physical validation has been performed. `ui.toggle` and `ui.select` remain `IMPLEMENTED`.
