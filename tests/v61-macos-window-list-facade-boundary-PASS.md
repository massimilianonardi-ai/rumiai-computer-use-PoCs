# v61 macOS Window List Facade Boundary — PASS

Date: 2026-08-24
Platform: macOS / Darwin
Result: PASS
Exit code: 0

Command executed:

```sh
./bin/nodejs/bin/node app/window-list-facade-boundary-test.js
```

Observed output:

```text
required isolated listWindows facade scope: PASS
required public listWindows function: PASS
required provider resolution retained: PASS
required desktop application resolution retained: PASS
required desktop.listWindows routing: PASS
required windows array validation: PASS
required observed state: PASS
required public listWindows export: PASS
forbidden direct agentCtrl.listWindows in listWindows facade: PASS
forbidden direct window-list command in listWindows facade: PASS
forbidden direct snapshotApplication backend detail in listWindows facade: PASS
forbidden direct agentCtrl backend reference in listWindows facade: PASS
required validated window.list capability retained: PASS
required macOS listWindows retained: PASS
required backend listWindows routing retained: PASS
window-list-facade-boundary=PASS
boundary_exit=0
```

Conclusion: the public ComputerControl.listWindows({app}) facade is correctly isolated from backend details and routes through the validated Desktop Plugin boundary.
