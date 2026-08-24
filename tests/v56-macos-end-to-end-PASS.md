# v56 — macOS end-to-end regression — PASS

**Date:** 2026-08-24

## Result

PASS — physical macOS ARM64 execution.

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
git pull
./cmd/agent-ctrl-start-cu-test
```

## Task

```text
Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.
```

## Observed evidence

- execution mode: `EXACT`
- context boot: `generic-gui -> macos`
- selected Provider: TextEdit, competence `VALIDATED`
- semantic plan remained exactly `NEW_DOCUMENT -> INPUT(PROVA) -> CLEAR`
- application readiness precondition PASS
- readiness evidence explicitly crossed the Desktop Plugin: `desktop=macos`
- TextEdit resolved at `/System/Applications/TextEdit.app`
- foreground verification observed `TextEdit`
- intent 1 `NEW_DOCUMENT` PASS
- intent 2 `INPUT` PASS with `method=ax-fill`, `verified=true`, `verification=ax-text-exact`
- intent 3 `CLEAR` PASS with `method=ax-fill-empty`, `verified=true`, `verification=ax-text-exact`
- `TASK COMPLETE: all 3 intents verified.`
- recovery inference: `0.00s`
- locator inference: `0.00s`
- Computer Control backend runtime closed normally
- Ollama service stopped normally

## Architectural conclusion

The v56 Computer Control facade boundary is physically validated end-to-end on macOS ARM64. Desktop lifecycle/foreground responsibilities can pass through the selected Desktop Plugin while accessibility snapshot/action behavior remains in the UI backend, without changing the validated v48 execution semantics.
