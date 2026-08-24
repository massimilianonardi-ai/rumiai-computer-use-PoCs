# v72 macOS Window Restore Desktop Plugin Boundary — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-restore-desktop-boundary-test.js
echo "boundary_exit=$?"
```

Exact output:

```text
required backend syntax: PASS
required validated v70 plugin syntax: PASS
required effective v72 plugin syntax: PASS
required loader syntax: PASS
required validated v70 plugin composition: PASS
required validated window.minimize capability preserved: PASS
required effective window.restore capability: PASS
required isolated restoreWindow scope: PASS
required full observed descriptor: PASS
required application context through validated base: PASS
required fresh raw pre-action window list: PASS
required descriptor re-resolution: PASS
required stale target failure: PASS
required ambiguous target failure: PASS
required current handle rebound diagnostics: PASS
required native minimized precondition: PASS
required native AXMinimized false mutation: PASS
required state-driven restored postcondition: PASS
required verified RESTORED success: PASS
required backend false-state verification marker: PASS
forbidden restore action through stale observed handle: PASS
forbidden plugin keyboard shortcut: PASS
forbidden plugin AppleScript: PASS
required darwin loader selects effective plugin: PASS
forbidden premature public restoreWindow facade: PASS
verified-window-restore-desktop-boundary=PASS
boundary_exit=0
```

Conclusion: the v72 Desktop Plugin boundary is satisfied. Physical restore behavior remains pending and is not claimed by this result.
