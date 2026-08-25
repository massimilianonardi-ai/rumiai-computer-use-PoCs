# macOS native control description physical validation — PASS

- Date: 2026-08-25
- Product: `rumiai-computer-control`
- Product branch: `main`
- Product base commit: `2729f9d750a648d8bcea6d5838ccfe30bd8870f4` plus the pending `ui.describe` worktree
- Validation repository base commit: `2ace8f878a58b4365d98f7a860fb37d98af2ea9a` plus the pending validation worktree
- Contract under validation: `0.9.0` development contract
- macOS: `26.5.2` build `25F84`
- Node.js: `v26.7.0`, portable runtime
- Accessibility backend: `agent-ctrl 0.1.4`, portable runtime
- Physical application: TextEdit with an isolated temporary document

## Result

```text
development-contract-version=PASS
describe-capability-present=PASS
describe-capability-available=PASS
describe-capability-physically-validated=PASS
text-field-observed=PASS
button-observed=PASS
slider-observed=PASS
text-field-role=PASS
text-field-visible=PASS
text-field-enabled=PASS
text-field-focused-observable=PASS
text-field-unavailable-checked-null=PASS
text-field-unavailable-selected-null=PASS
text-field-unavailable-actions-null=PASS
text-field-unavailable-range-null=PASS
text-field-bounds=PASS
button-role=PASS
button-enabled-observable=PASS
button-null-value=PASS
button-bounds=PASS
slider-role=PASS
slider-number-value=PASS
slider-visible-observable=PASS
slider-enabled-observable=PASS
slider-range-unobservable=PASS
stale-element-fails-closed=PASS
physical-native-control-describe=PASS
```

The existing external RumiAI compatibility path was also rerun after the new
operation:

```text
compat-runtime=PASS
compat-application-ready=PASS
compat-snapshot=PASS
compat-find=PASS
compat-set-text=PASS
compat-get-exact=PASS
physical-rumiai-external-adapter=PASS
```

Conclusion: normalized native control description is physically validated on
macOS for text fields, buttons and sliders. Unavailable Accessibility data is
reported as `null`, and stale handles fail closed.
