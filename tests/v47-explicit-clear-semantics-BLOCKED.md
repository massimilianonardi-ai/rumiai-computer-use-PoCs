# v47 — Explicit Clear Semantics

**Date:** 2026-08-23
**Status:** BLOCKED BEFORE CLEAR EXECUTION
**Environment:** Apple Silicon Mac / macOS / agent-ctrl backend / ministral-3:3b / vision off

## Physical test

Task:

```text
Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.
```

Execution mode:

```text
[execution-mode] EXACT
```

Planner output:

```json
[
  {"id":1,"intent":"NEW_DOCUMENT","app":"TextEdit","target":null,"query":null,"text":null,"index":0},
  {"id":2,"intent":"INPUT","app":"TextEdit","target":null,"query":null,"text":"PROVA","index":0},
  {"id":3,"intent":"CLEAR","app":"TextEdit","target":null,"query":null,"text":null,"index":0}
]
```

Observed failure:

```text
[intent 1] attempt 1 failed: NEW_DOCUMENT requires an active application
[intent 1] recovery decision: {"action":"NO_RECOVERY",...}
[intent 1] FAIL: NEW_DOCUMENT requires an active application
```

## Classification

The test did **not** reach the `CLEAR` intent. Therefore v47 Clear semantics are not validated or invalidated by this run.

The blocker is a missing application activation precondition in EXACT mode: provider selection resolved TextEdit, but the semantic plan omitted `ACTIVATE_APP` before `NEW_DOCUMENT`.

This must be handled as an architectural/precondition issue, not as GUI recovery.

## Conclusion

v47 status: **PHYSICAL TEST BLOCKED**.

Next step: enforce provider/application readiness before application-dependent intents, then rerun the same v47 physical test unchanged.
