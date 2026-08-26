# micro-PoC — expand/collapse controls

Status: **NOT_RUN_PHYSICALLY**

Product commits:
- implementation: `fc92aa9ed0fe5208c8c2b0a08608fcec8f5ff406`
- SDK compatibility: `450476d6008cde5d3dafbd332f30b5beeb54b8f5`
- cumulative type compatibility fix: `ad1f6708209385f19a707a236f5e8309a28b5097`

Capabilities: `ui.expand`, `ui.collapse`.

The first boundary run `32947027961` is preserved as FAIL. It exposed direct-entrypoint declaration compatibility and a missing `info()` method in the PoC fixture; both are corrected without changing the disclosure semantics.

Question: can an observable `expanded` state be changed idempotently and verified after a fresh Accessibility observation without trusting a stale `@eN`?

Boundary test: `contract-tests/native-controls-disclosure.test.js`.
Physical test: `physical-tests/macos-native-control-disclosure.js`.
Complete physical success marker: `physical-native-control-disclosure=PASS`.
