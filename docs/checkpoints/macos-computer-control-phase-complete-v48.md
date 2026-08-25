# RumiAI Computer Control — macOS phase complete at v48

**Date:** 2026-08-23
**Canonical build:** v48 — Application Readiness Invariant
**Status:** PHYSICALLY VALIDATED on Apple Silicon macOS

## Validated public Computer Control surface

```text
ensureReady()       VALIDATED
setText()           VALIDATED — strict equality
clear()             VALIDATED — explicit empty semantics
click()             VALIDATED
focus()             VALIDATED
press()             VALIDATED
snapshot()          VALIDATED
find()              VALIDATED
get(text)           VALIDATED
getBounds()         VALIDATED
getCurrentWindow()  VALIDATED
getForeground()     VALIDATED
waitStable()        VALIDATED
```

`waitUntilChanged()` remains implemented and physically exercised through synchronized operations.

## Validated invariants

- LLM decides WHAT through semantic intents.
- Resolver decides WHICH UI element.
- Computer Control/backend decides HOW.
- LLM does not invent runtime coordinates.
- Actions require verification; no false PASS.
- GOAL may normalize redundant operations; EXACT preserves semantic order.
- Literal payloads are preserved deterministically (`v45`).
- `setText()` verifies exact equality (`v46`).
- Empty text has explicit `clear()` semantics; `setText("")` is rejected (`v47`).
- Selected application readiness is an executor precondition, not an injected semantic intent (`v48`).
- Internal software failures do not authorize GUI recovery.
- Synchronization is based on observed state, not elapsed time.

## v48 physical closure test

Task:

```text
Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.
```

Observed semantic plan:

```text
NEW_DOCUMENT -> INPUT(PROVA) -> CLEAR
```

Observed readiness evidence:

```text
precondition PASS | application-ready=TextEdit | source=executor
```

Observed exact setText verification:

```text
computer-control.setText ... verified=true; verification=ax-text-exact
```

Observed clear verification:

```text
computer-control.clear ... verified=true; verification=ax-text-exact
```

Final result:

```text
TASK COMPLETE: all 3 intents verified.
```

## Backend boundary

RumiAI is not architecturally dependent on `agent-ctrl`; it is the currently selected macOS backend. Browser/Electron content that is not observable through the current AX backend remains classified as a backend/surface limitation rather than worked around with blind clicks or LLM-invented coordinates.

## Deferred / not required for this phase

- browser/Electron backend (e.g. CDP-class surface) only when a real use case requires it;
- clipboard public API only when required by a real flow;
- `listWindows()` / `focusWindow()` only after proving a concrete backend;
- no speculative API expansion.

## Next phase

Before further functional expansion, adapt the validated Computer Control architecture for:

```text
Linux x64
Linux ARM64
```

The v48 semantics and validated public boundary are the portability baseline. OS/backend-specific mechanisms must remain behind Computer Control and must not leak into semantic planning.
