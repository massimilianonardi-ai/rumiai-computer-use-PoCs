# v59 macOS window close boundary — PASS

Date: 2026-08-24
Platform: macOS / darwin

## Result

Boundary test PASS after replacing the stale post-close `getCurrentWindow()` verification with a fresh AX snapshot based postcondition.

Observed output:

```text
required public closeWindow function: PASS
required desktop.closeWindow routing: PASS
required public closeWindow export: PASS
required provider resolution retained: PASS
required desktop application resolution retained: PASS
forbidden direct Cmd+W in facade: PASS
forbidden direct agent-ctrl close implementation in facade: PASS
required window.close capability implemented: PASS
required macOS closeWindow implementation: PASS
required macOS Cmd+W implementation: PASS
required pre-close current-window observation: PASS
required fresh AX post-close snapshot: PASS
required AX snapshot window-id extraction: PASS
required verified close failure: PASS
required verified AX close postcondition: PASS
forbidden closeWindow still deferred: PASS
forbidden stale post-close getCurrentWindow verification: PASS
forbidden legacy current-window postcondition: PASS
window-close-boundary=PASS
boundary_exit=0
```

## Validated boundary

- Public Computer Control exposes normalized `closeWindow()`.
- Facade routes through `desktop.closeWindow()`.
- `Cmd+W` remains macOS plugin implementation detail.
- Pre-close window identity is observed before the action.
- Post-close verification uses a fresh AX application snapshot.
- Stale `getCurrentWindow()` is explicitly forbidden as the post-close verifier.
- Legacy `current-window-changed-or-absent` postcondition is forbidden.

Status: boundary PASS. Physical validation still required before v59 can be marked VALIDATED.
