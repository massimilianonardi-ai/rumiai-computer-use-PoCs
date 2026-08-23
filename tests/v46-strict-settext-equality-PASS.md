# v46 — Strict setText Equality

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED
**Environment:** Apple Silicon Mac / macOS / agent-ctrl backend / ministral-3:3b / vision off

## Physical test

Task:

```text
Crea un nuovo documento di testo e scrivi: Ciao RumiAI.
```

Observed evidence:

```text
[payload] kind=INPUT | source=task-literal | chars=12 | applied=true
```

Planner payload:

```text
"text":"Ciao RumiAI."
```

Strict setText verification:

```text
computer-control.setText; ref=@e0; role=text-field; precondition=READY; method=ax-fill; verified=true; verification=ax-text-exact
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

v46 Strict setText Equality is physically VALIDATED. The previous v45 Literal Payload Fidelity behavior is preserved.

Artifact SHA-256:

```text
9b54e66df72ccf72cd4b9b2fb4654bcc56d67ca5b9b5309ebbe317acd49753f3
```
