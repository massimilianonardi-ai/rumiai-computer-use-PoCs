# v82 macOS Window Control Current-Window Regression Boundary — PASS

Date: 2026-08-25

```text
required facade syntax: PASS
required plugin syntax: PASS
required final loader v82: PASS
required native current-window observation: PASS
required complete current-window reconciliation: PASS
required absent current-window failure: PASS
required ambiguous current-window failure: PASS
forbidden positional current-window observation: PASS
required window.list implemented: PASS
required window.current implemented: PASS
required window.focus implemented: PASS
required window.close implemented: PASS
required window.minimize implemented: PASS
required window.restore implemented: PASS
required window.maximize implemented: PASS
required window.move implemented: PASS
required window.resize implemented: PASS
required public listWindows: PASS
required exported listWindows: PASS
required public getCurrentWindow: PASS
required exported getCurrentWindow: PASS
required public focusWindow: PASS
required exported focusWindow: PASS
required public closeWindow: PASS
required exported closeWindow: PASS
required public minimizeWindow: PASS
required exported minimizeWindow: PASS
required public restoreWindow: PASS
required exported restoreWindow: PASS
required public maximizeWindow: PASS
required exported maximizeWindow: PASS
required public moveWindow: PASS
required exported moveWindow: PASS
required public resizeWindow: PASS
required exported resizeWindow: PASS
forbidden Windows capability overclaim: PASS
forbidden Linux capability overclaim: PASS
macos-window-control-phase-boundary=PASS
boundary_exit=0
```

The effective v82 macOS Desktop Plugin observes the physically focused native window and reconciles it against a fresh complete window list. The integrated physical regression remains pending.
