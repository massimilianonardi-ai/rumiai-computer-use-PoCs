# v73 macOS Window Restore Public Facade Boundary — PASS

Date: 2026-08-25
Platform: physical macOS host
Status: PASS

Command executed:

```sh
./bin/nodejs/bin/node app/window-restore-facade-boundary-test.js
echo "boundary_exit=$?"
```

Exact output:

```text
required facade syntax: PASS
required effective plugin syntax: PASS
required loader syntax: PASS
required isolated restoreWindow facade scope: PASS
required application requirement: PASS
required observed id preservation: PASS
required observed title preservation: PASS
required observed process preservation: PASS
required observed pid preservation: PASS
required observed handle requirement: PASS
required provider resolution: PASS
required desktop application resolution: PASS
required desktop restore routing: PASS
required full descriptor routing: PASS
required verified success guard: PASS
required restored success guard: PASS
required minimized false success guard: PASS
required verified failure propagation: PASS
required restored failure propagation: PASS
required restored success state: PASS
required minimized false success: PASS
required restored true success: PASS
required verified true success: PASS
required native verification propagation: PASS
required observed handle diagnostics: PASS
required action handle diagnostics: PASS
required handle rebound diagnostics: PASS
forbidden direct agentCtrl backend reference: PASS
forbidden direct agent-ctrl backend command: PASS
forbidden native minimized backend reference: PASS
forbidden Swift helper reference: PASS
forbidden keyboard shortcut: PASS
forbidden AppleScript: PASS
forbidden coordinate targeting: PASS
forbidden id-only descriptor weakening: PASS
required public restoreWindow function: PASS
required public restoreWindow export: PASS
required validated window.restore capability: PASS
required validated plugin restoreWindow: PASS
required validated native verification marker: PASS
required darwin loader selects validated plugin: PASS
verified-window-restore-facade-boundary=PASS
boundary_exit=0
```

Conclusion: the public restore facade boundary is satisfied. Physical behavior remains pending and is not claimed by this result.
