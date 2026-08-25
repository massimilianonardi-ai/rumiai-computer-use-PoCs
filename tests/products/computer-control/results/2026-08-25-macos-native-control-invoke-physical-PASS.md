# macOS native control invocation physical validation — PASS

- Date: 2026-08-25
- Product: `rumiai-computer-control`
- Product branch: `main`
- Product base commit: `1db40374da1700b9a5369ad9a07196704b61acdd` plus the pending `ui.invoke` worktree
- Validation repository base commit: `ffd44e860d7d5b4744b9fad47420efd53287d2d7` plus the pending validation worktree
- Contract under validation: `0.9.0` development contract
- macOS: `26.5.2` build `25F84`
- Node.js: `v26.7.0`, portable runtime
- Accessibility backend: `agent-ctrl 0.1.4`, portable runtime
- Physical application: TextEdit with an isolated temporary document
- Physical control: native Find-bar button (`Done`/`Fine`)

## Result

```text
invoke-capability-present=PASS
invoke-capability-available=PASS
invoke-capability-physically-validated=PASS
non-invokable-text-field-observed=PASS
non-invokable-role-fails-closed=PASS
native-dialog-button-observed=PASS
disabled-button-observed=PASS
invoke-target-role-reobserved=PASS
invoke-target-enabled=PASS
invoke-target-visible=PASS
disabled-control-fails-closed=PASS
stale-control-fails-closed=PASS
invoke-state=PASS
invoke-delivery-verified=PASS
invoke-target-role=PASS
invoke-native-primary-action=PASS
invoke-semantic-consequence-not-invented=PASS
invoke-native-strategy=PASS
caller-observed-semantic-consequence=PASS
physical-native-control-invoke=PASS
```

Conclusion: `ui.invoke` is physically validated on macOS. The runtime
re-observes the native role and enabled state, delivers the primary AX action,
and reports only delivery evidence. The test separately observed that the Find
bar closed after invoking its native button.
