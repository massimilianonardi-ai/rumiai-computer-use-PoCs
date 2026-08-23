# v48 — Application Readiness Invariant / v47 CLEAR completion

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED
**Environment:** Apple Silicon Mac / macOS / agent-ctrl backend / ministral-3:3b / vision off

## Physical test

Task:

```text
Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.
```

Execution mode:

```text
EXACT
```

Semantic plan preserved exactly as requested:

```text
NEW_DOCUMENT -> INPUT(PROVA) -> CLEAR
```

## Application readiness evidence

Before `NEW_DOCUMENT`, the executor established the selected provider deterministically without injecting `ACTIVATE_APP` into the semantic plan:

```text
[intent 1] precondition PASS | application-ready=TextEdit | source=executor | ensureReady provider="TextEdit"; path="/System/Applications/TextEdit.app"; executable="TextEdit"; bundle="com.apple.TextEdit"; launch=true; switch=agent-ctrl switch-app com.apple.TextEdit; snapshot=settled; foreground=TextEdit; switchAttempts=3; snapshotAttempts=1
```

`NEW_DOCUMENT` then passed:

```text
[intent 1] PASS
computer-control.press Cmd+N; sync=changed+stable; changedAttempts=1; changed=true
```

## INPUT regression evidence

```text
[intent 2] PASS
computer-control.setText; ref=@e0; role=text-field; precondition=READY; method=ax-fill; verified=true; verification=ax-text-exact
```

## CLEAR evidence

```text
[intent 3] PASS
computer-control.clear; ref=@e0; role=text-field; precondition=READY; method=ax-fill-empty; verified=true; verification=ax-text-exact
```

Final result:

```text
TASK COMPLETE: all 3 intents verified.
```

Runtime cleanup:

```text
[computer-control] backend=agent-ctrl runtime closed.
```

## Conclusion

- v47 `clear()` explicit semantics: **PHYSICALLY VALIDATED**.
- v48 Application Readiness Invariant: **PHYSICALLY VALIDATED**.
- EXACT preserves the user-requested semantic order; application activation/readiness remains an execution precondition (HOW), not a semantic intent (WHAT).
- v46 strict `setText()` equality remains preserved.

v48 artifact SHA-256:

```text
9487ff56450c7ede324736cd2ea7030a91de078d470ff0e295fe20ac43ba319e
```
