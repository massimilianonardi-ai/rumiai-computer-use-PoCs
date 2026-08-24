# v66 macOS Safe Window Focus Contract — Boundary PASS

Date: 2026-08-24
Platform: macOS / Apple Silicon

## Command

```sh
cd /Volumes/RumiAI/rumiai-computer-use-PoCs
./bin/nodejs/bin/node app/window-focus-safe-boundary-test.js
echo "boundary_exit=$?"
```

## Observed output

```text
required backend syntax: PASS
required plugin syntax: PASS
required facade syntax: PASS
required native focused-window helper integration: PASS
required native focused-window observation: PASS
required state-driven native focused-window wait: PASS
required native focus verification marker: PASS
required isolated plugin focusWindow scope: PASS
required descriptor normalization: PASS
required insufficient descriptor failure: PASS
required fresh raw pre-action window list: PASS
required descriptor re-resolution: PASS
required stale descriptor failure: PASS
required ambiguous descriptor failure: PASS
required current action handle: PASS
required rebound diagnostics: PASS
required native postcondition: PASS
forbidden old pinned-id postcondition: PASS
forbidden action through observed handle: PASS
required isolated facade focusWindow scope: PASS
required facade full observed descriptor: PASS
required descriptor routing to desktop plugin: PASS
forbidden old id-only facade routing: PASS
required facade rebound diagnostics: PASS
required facade native verification default: PASS
required window.focus capability retained: PASS
safe-window-focus-boundary=PASS
boundary_exit=0
```

## Classification

BOUNDARY PASS.

The v66 contract is statically protected: the observed window descriptor is preserved across the public facade, the plugin re-resolves the descriptor against a fresh pre-action window list, action delivery uses the current action handle rather than the originally observed positional handle, and post-focus verification is delegated to the validated native macOS focused-window observer. The obsolete `window-list-target-pinned` verification is forbidden.

v66 remains PHYSICAL TEST PENDING until intentional handle-rebinding behavior is exercised physically and committed.
