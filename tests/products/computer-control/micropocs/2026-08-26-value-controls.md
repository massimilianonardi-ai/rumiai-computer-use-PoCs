# micro-PoC — value/range controls

Status: **NOT_RUN_PHYSICALLY**

Product implementation: `9992d24e5ced5864e7af66bb19a7e07faf24f225`
Cumulative compatibility head: `ad1f6708209385f19a707a236f5e8309a28b5097`
Capabilities: `ui.setValue`, `ui.increment`, `ui.decrement`.

Question: can Computer Control mutate an observable value and verify the exact requested value, while increment/decrement prove only the observed numeric direction and never fabricate an unavailable step size?

Boundary: `contract-tests/native-controls-value.test.js`.
Physical: `physical-tests/macos-native-control-value.js` using a temporary Safari HTML range input. It restores the original value before exit.

Complete physical success marker: `physical-native-control-value=PASS`.
Any FAIL/BLOCKED must be committed exactly before diagnosis. Capabilities remain `IMPLEMENTED` until physical evidence passes.
