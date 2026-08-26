# micro-PoC — stateful native controls

Status: **NOT_RUN_PHYSICALLY**

Product repository: `massimilianonardi-ai/rumiai-computer-control`
Product commits under test:

- implementation: `35f3be07914faeae133237b566d6ae4bd0d79557`
- boundary compatibility fix: `b7e7e62db1fca98e888938fb4af4f62237d345ea`

Capabilities: `ui.toggle`, `ui.select`

## Question

Can the macOS backend mutate stateful native controls idempotently and accept success only after a fresh Accessibility observation proves the requested postcondition?

## Boundary test

```sh
node --test tests/products/computer-control/contract-tests/native-controls-stateful.test.js
```

The initial full product boundary run `32946412098` recorded 15 PASS / 2 FAIL because the first implementation moved the already validated `describe`/`invoke` SDK definitions behind inheritance. That exact failure is preserved in `results/2026-08-26-native-control-stateful-boundary-FAIL.md`. Product commit `b7e7e62...` restores those public source surfaces without changing their semantics.

## Physical test

```sh
node tests/products/computer-control/physical-tests/macos-native-control-stateful.js
```

The harness creates a temporary local HTML fixture and opens it in Safari. It does not modify System Settings. It verifies checkbox mutation/restoration, checkbox idempotence, radio selection and selection idempotence using `ui.describe` postconditions.

Expected terminal marker on complete success:

```text
physical-native-control-stateful=PASS
```

Any physical failure or unavailable Accessibility state must be recorded exactly as FAIL/BLOCKED before code diagnosis or modification. The product capability must remain `IMPLEMENTED` until this physical test is run and the exact evidence is committed.
