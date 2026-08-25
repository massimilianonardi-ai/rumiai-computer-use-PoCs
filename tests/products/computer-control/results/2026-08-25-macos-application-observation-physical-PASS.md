# macOS application and element observation physical result

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Contract/runtime/backend: `0.3.0`

Observed evidence:

```text
runtime-info=PASS
runtime-ready=PASS
application-ready=PASS
foreground-textedit=PASS
snapshot-observed=PASS
editable-ref-fresh=PASS
bounds-observed=PASS
text-before-observed=PASS
set-text-verified=true
set-text-verification=ax-text-exact
text-after-exact=PASS
physical-runtime-snapshot-find-set-text=PASS
```

The test also detected and corrected a quoted-scalar decoding defect at the new
adapter boundary before validation was granted.
