# Native control invocation boundary validation — PASS

- Date: 2026-08-25
- Product: `rumiai-computer-control`
- Product branch: `main`
- Product base commit: `1db40374da1700b9a5369ad9a07196704b61acdd` plus the pending `ui.invoke` worktree
- Validation repository base commit: `ffd44e860d7d5b4744b9fad47420efd53287d2d7` plus the pending validation worktree
- Contract under validation: `0.9.0` development contract
- Node.js: `v26.7.0`, portable runtime

## Scope

- canonical `ui.invoke` routing and result;
- malformed handle rejection before dispatch;
- native delivery evidence distinct from the application consequence;
- actual backend role replacing untrusted caller metadata;
- distinct unsupported-role and disabled-control errors;
- SDK and RumiAI adapter exposure;
- complete Computer Control contract regression.

## Result

```text
ui.describe routes an actionable target without backend-specific fields=PASS
ui.describe rejects missing or malformed element handles before backend dispatch=PASS
control description schema makes unavailable state explicit=PASS
SDK and RumiAI adapter expose the canonical operation=PASS
ui.invoke routes an actionable target and preserves delivery semantics=PASS
ui.invoke rejects missing or malformed element handles before dispatch=PASS
macOS mapping reports action delivery without inventing the semantic consequence=PASS
macOS mapping keeps role, state and visibility failures distinct=PASS
invoke schemas, SDK and RumiAI adapter expose the canonical operation=PASS
runtime.info and ui.setText cross the local RPC boundary=PASS
ui.find performs normalized semantic matching over caller observation=PASS
ui.setText rejects empty text without invoking GUI recovery=PASS
computer-control-structure=PASS
CONTROL_VOCABULARY_SYNC=PASS
CLEAN_PORTABLE_INSTALL_INVOKE=PASS
physical-rumiai-external-adapter=PASS
tests=12
pass=12
fail=0
```

Conclusion: `ui.invoke` passes the local JSON-RPC boundary while preserving the
distinction between verified action delivery and a caller-observed semantic
consequence.
