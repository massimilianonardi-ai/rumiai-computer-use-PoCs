# v71 macOS Window Minimize Public Facade Boundary — PASS

Date: 2026-08-25
Platform: macOS ARM64

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
./bin/nodejs/bin/node app/window-minimize-facade-boundary-test.js
echo "boundary_exit=$?"
```

## Exact result

```text
required facade syntax: PASS
required effective plugin syntax: PASS
required loader syntax: PASS
required isolated minimizeWindow facade scope: PASS
required application requirement: PASS
required observed id preservation: PASS
required observed title preservation: PASS
required observed process preservation: PASS
required observed pid preservation: PASS
required observed handle requirement: PASS
required provider resolution: PASS
required desktop application resolution: PASS
required desktop minimize routing: PASS
required full descriptor routing: PASS
required verified success guard: PASS
required verified failure propagation: PASS
required minimized success state: PASS
required minimized true success: PASS
required verified true success: PASS
required native verification propagation: PASS
required observed handle diagnostics: PASS
required action handle diagnostics: PASS
required handle rebound diagnostics: PASS
forbidden direct agentCtrl backend reference: PASS
forbidden direct agent-ctrl backend command: PASS
forbidden native minimized backend reference: PASS
forbidden Swift helper reference: PASS
forbidden Cmd+M shortcut: PASS
forbidden AppleScript: PASS
forbidden coordinate targeting: PASS
forbidden id-only descriptor weakening: PASS
required public minimizeWindow function: PASS
required public minimizeWindow export: PASS
required validated window.minimize capability: PASS
required validated plugin minimizeWindow: PASS
required validated native verification marker: PASS
required darwin loader selects validated plugin: PASS
verified-window-minimize-facade-boundary=PASS
boundary_exit=0
```

## Classification

PASS.

The public `ComputerControl.minimizeWindow({app, window})` facade preserves the full observed descriptor and routes only through the validated Desktop Plugin operation. It reports success only for verified native minimized state and contains no backend, macOS helper, shortcut, AppleScript, coordinate, title-only or id-only action implementation.

v71 remains PHYSICAL TEST PENDING until the public facade path is exercised against a real macOS window.
