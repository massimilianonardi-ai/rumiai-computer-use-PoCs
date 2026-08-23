# v53 — Platform-Aware Context Selection — Linux ARM64 test

**Date:** 2026-08-23
**Status:** PHYSICALLY VALIDATED on Linux ARM64
**Environment:** Ubuntu 26.04 ARM64 VM

## Test

```text
./bin/nodejs/bin/node <<'NODE'
const {
  createContextSession,
  contextSummary
} = require("./app/context-manager");

const s = createContextSession();

console.log("platform=" + process.platform);
console.log("base=" + contextSummary(s.snapshot().active));
console.log(
  "system-settings=" +
  contextSummary(
    s.select("Open System Settings and open Bluetooth.").selected
  )
);
s.observeApp("TextEdit");
console.log("after-textedit=" + contextSummary(s.snapshot().active));
NODE
```

## Observed result

```text
platform=linux
base=generic-gui -> linux
system-settings=generic-gui -> linux
after-textedit=generic-gui -> linux
```

## Validation

- Linux platform detection through Node `process.platform`: PASS
- Linux base context selected: PASS
- macOS base context excluded: PASS
- System Settings context excluded on Linux even when named in the task: PASS
- TextEdit context excluded on Linux even when observed as current app: PASS
- Generic GUI context preserved: PASS

v53 is physically validated on Linux ARM64 for platform-aware context selection.

A macOS regression check is still required because `app/context-manager.js` is a shared component and macOS remains the primary target.