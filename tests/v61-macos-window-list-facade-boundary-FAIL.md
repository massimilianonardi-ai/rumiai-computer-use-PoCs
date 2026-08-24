# v61 macOS Window List Facade Boundary — FAIL

Physical/static boundary test executed on macOS.

Command:

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull
./bin/nodejs/bin/node app/window-list-facade-boundary-test.js
echo "boundary_exit=$?"
```

Observed result:

```text
required public listWindows function: PASS
required provider resolution retained: PASS
required desktop application resolution retained: PASS
required desktop.listWindows routing: PASS
required windows array validation: PASS
required public listWindows export: PASS
required observed state: PASS
forbidden direct agentCtrl.listWindows in facade: PASS
forbidden direct window-list command in facade: PASS
forbidden direct plugin backend details in facade: FAIL
required validated window.list capability retained: PASS
required macOS listWindows retained: PASS
required backend listWindows routing retained: PASS
window-list-facade-boundary=FAIL
boundary_exit=1
```

Status: **FAIL**.

The failure is recorded before diagnosis or modification, per micro-PoC workflow. All v61 routing requirements passed; the only failing assertion was `forbidden direct plugin backend details in facade`.
