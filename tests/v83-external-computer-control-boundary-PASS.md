# v83 — External Computer Control Boundary

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

The production/high-level RumiAI modules now import
`computer-control-external.js`, which resolves the compatibility adapter owned
by the standalone `rumiai-computer-control` project.

Observed result:

```text
external wrapper syntax: PASS
external adapter environment override: PASS
external adapter default: PASS
agent-loop.js uses external boundary: PASS
executors.js uses external boundary: PASS
recovery.js uses external boundary: PASS
semantic-ui.js uses external boundary: PASS
all high-level direct internal facade checks: PASS
all high-level direct agent-ctrl checks: PASS
external-computer-control-boundary=PASS
```

Historical diagnostics and PoC implementations remain in place, but they are no
longer the production import boundary for the four high-level consumers.

The standalone compatibility adapter also passed its physical
snapshot/find/setText/get scenario.

Full consumer validation was then run with the external backend reported as
`macos-embedded-v82` and its runtime loaded from `rumiai-computer-control`.
RumiAI completed this task:

```text
Crea un nuovo documento di testo e scrivi: Separazione Computer Control completata.
```

Observed result:

```text
NEW_DOCUMENT: PASS
INPUT: PASS
exact text verification: PASS
TASK COMPLETE: all 2 intents verified
external runtime clean shutdown: PASS
```
