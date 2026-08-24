# v63 macOS Window Focus Facade Boundary — PASS

Physical/static boundary execution reported by the user on 2026-08-24.

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull
./bin/nodejs/bin/node app/window-focus-facade-boundary-test.js
echo "boundary_exit=$?"
```

## Exact result

```text
required isolated focusWindow facade scope: PASS
required application requirement: PASS
required stable window id extraction: PASS
required stable window id requirement: PASS
required provider resolution retained: PASS
required desktop application resolution retained: PASS
required desktop.focusWindow routing: PASS
required id-only desktop target: PASS
required verified failure propagation: PASS
required verified success propagation: PASS
required focused state: PASS
forbidden direct agentCtrl backend reference: PASS
forbidden direct agent-ctrl backend command: PASS
forbidden direct snapshotApplication backend detail: PASS
forbidden title-based action targeting: PASS
forbidden coordinate-based action targeting: PASS
required public focusWindow function: PASS
required public focusWindow export: PASS
required validated window.focus capability retained: PASS
required validated macOS focusWindow retained: PASS
required target pinned postcondition retained: PASS
required focus verification marker retained: PASS
window-focus-facade-boundary=PASS
boundary_exit=0
```

## Classification

PASS.

The public facade preserves the ID-first contract and routes exclusively through `desktop.focusWindow()` without backend, snapshot, title-based, or coordinate-based action details in the facade scope.

v63 remains PHYSICAL TEST PENDING until the public facade focus path is exercised against real macOS windows.
