# micro-PoC — expand/collapse controls

Status: **NOT_RUN_PHYSICALLY**

Product commits:
- implementation: `fc92aa9ed0fe5208c8c2b0a08608fcec8f5ff406`
- SDK/type compatibility: `450476d6008cde5d3dafbd332f30b5beeb54b8f5`

Capabilities: `ui.expand`, `ui.collapse`.

Question: can an observable `expanded` state be changed idempotently and verified after a fresh Accessibility observation without trusting a stale `@eN`?

Boundary test is included in `contract-tests/native-controls-disclosure.test.js`. Physical validation uses a temporary local Safari ARIA tree-item fixture and must emit `physical-native-control-disclosure=PASS` for complete success. No capability is physically validated by committing this harness.
