# v49–v53 — macOS end-to-end regression

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on macOS ARM64
**Environment:** MacBook Air Apple Silicon

## Test

```text
git pull
./cmd/agent-ctrl-start-cu-test
```

Task entered exactly:

```text
Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.
```

## Observed result

Key evidence from the physical run:

```text
[context-session] boot: generic-gui -> macos
[execution-mode] EXACT
[provider] selected: TextEdit | competence=VALIDATED
[context] planner: generic-gui -> macos -> text-editing -> textedit
[plan] [{"id":1,"intent":"NEW_DOCUMENT","app":"TextEdit"...},{"id":2,"intent":"INPUT","app":"TextEdit"..."text":"PROVA"...},{"id":3,"intent":"CLEAR","app":"TextEdit"...}]
[intent 1] precondition PASS | application-ready=TextEdit
[intent 1] PASS
[intent 2] PASS ... method=ax-fill; verified=true; verification=ax-text-exact
[intent 3] PASS ... method=ax-fill-empty; verified=true; verification=ax-text-exact
TASK COMPLETE: all 3 intents verified.
Recovery inference: 0.00s.
Locator inference: 0.00s.
[computer-control] backend=agent-ctrl runtime closed.
srv-stop: SERVER 'ollama' stopped
```

## Validation

- macOS platform context selection after v53: PASS
- provider selection: TextEdit: PASS
- EXACT semantic plan preserved: PASS
- application readiness precondition: PASS
- `NEW_DOCUMENT`: PASS
- literal `INPUT("PROVA")`: PASS
- exact AX text verification: PASS
- explicit `CLEAR`: PASS
- exact empty-text verification: PASS
- no recovery inference required: PASS
- runtime cleanup: PASS
- Ollama service shutdown: PASS

## Interpretation

The physical Computer Control behavior validated at v48 remains intact after the portability changes introduced in v49–v53.

The current macOS baseline therefore retains the validated v48 execution semantics while using the newer platform-aware installers, shell/runtime changes, GUI backend boundary, and context selection logic.
