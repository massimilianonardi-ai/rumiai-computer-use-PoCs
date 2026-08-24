# v59 macOS Window Close — physical action PASS / verification FAIL

Date: 2026-08-24
Platform: macOS / Apple Silicon
Overall v59 status: **NOT VALIDATED**

## User physical observation

The TextEdit window closed correctly on screen during the v59 physical test.

## Correlation with test output

The action layer reported:

```text
window-close-method=agent-ctrl press Cmd+W
```

After the window visibly closed, the verification layer still returned the same stale current-window identity:

```text
before-fingerprint=id:pid:58835:window:0
plugin-current-window={"field":"window","value":{"id":"pid:58835:window:0","title":"Senza nome"}}
window-close-error=WINDOW_CLOSE_UNVERIFIED
```

## Classification

- Physical close action: **PASS**
- `Cmd+W` delivery/path: **PASS**
- Current-window postcondition observation: **FAIL / stale observation suspected**
- Verified Window Close micro-PoC v59: **NOT VALIDATED**

The implementation must not be changed to treat action delivery as success. v59 requires an independently observed postcondition. The next step is to identify a reliable macOS observation for disappearance/change of the closed window.
