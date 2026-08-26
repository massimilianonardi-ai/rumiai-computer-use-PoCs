# micro-PoC — stateful native controls

Status: **NOT_RUN**

Product repository: `massimilianonardi-ai/rumiai-computer-control`
Product commit under test: `35f3be07914faeae133237b566d6ae4bd0d79557`
Capabilities: `ui.toggle`, `ui.select`

## Question

Can the macOS backend mutate stateful native controls idempotently and accept success only after a fresh Accessibility observation proves the requested postcondition?

## Boundary test

```sh
node --test tests/products/computer-control/contract-tests/native-controls-stateful.test.js
```

Expected: router validation, canonical mapping, schemas/SDK/adapter exposure and `IMPLEMENTED` (not physically validated) capability state all pass.

## Physical test

```sh
node tests/products/computer-control/physical-tests/macos-native-control-stateful.js
```

The harness creates a temporary local HTML fixture and opens it in Safari. It does not modify System Settings. It verifies checkbox mutation/restoration, checkbox idempotence, radio selection and selection idempotence using `ui.describe` postconditions.

Expected terminal marker on complete success:

```text
physical-native-control-stateful=PASS
```

Any failure or unavailable Accessibility state must be recorded exactly as FAIL/BLOCKED before code diagnosis or modification. The product capability must remain `IMPLEMENTED` until this physical test is run and the exact evidence is committed.
