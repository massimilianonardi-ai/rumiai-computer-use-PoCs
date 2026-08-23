# v55 macOS end-to-end — PASS

**Date:** 2026-08-23

## Task

`Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.`

## Physical result

PASS on macOS ARM64.

Observed evidence:
- execution mode EXACT
- planner kept `NEW_DOCUMENT -> INPUT(PROVA) -> CLEAR`
- application readiness passed through Desktop Plugin: `desktop=macos`
- TextEdit launched/activated and verified foreground
- `NEW_DOCUMENT` PASS
- `INPUT` PASS with `method=ax-fill`, `verification=ax-text-exact`
- `CLEAR` PASS with `method=ax-fill-empty`, `verification=ax-text-exact`
- all 3 intents verified
- recovery inference `0.00s`
- locator inference `0.00s`
- agent-ctrl runtime closed
- Ollama service stopped cleanly

Relevant readiness evidence:

`ensureReady provider="TextEdit"; desktop=macos; path="/System/Applications/TextEdit.app"; executable="TextEdit"; bundle="com.apple.TextEdit"; launch=true; switch=agent-ctrl switch-app com.apple.TextEdit; snapshot=settled; foreground=TextEdit; switchAttempts=2; snapshotAttempts=1`

## Conclusion

v55 Desktop Plugin Application Readiness Boundary is physically validated on macOS ARM64. The OS-specific application lifecycle path is now routed through the selected Desktop Plugin without regressing the previously validated Computer Control behavior.
