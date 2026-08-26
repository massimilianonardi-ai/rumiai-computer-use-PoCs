# Development workflow

> Canonical operational workflow: `../../../docs/workflows/computer-control-development-validation-workflow.md`.
>
> This file retains the capability lifecycle and promotion rules. If execution mechanics here conflict with the canonical workflow, the document under `docs/workflows/` governs how development/test sessions are run, while the lifecycle below governs promotion and release.

## Repository roles

```text
rumiai-computer-use-PoCs  -> laboratory and exact evidence
rumiai-computer-control   -> standalone versioned product
RumiAI                    -> consumer of released artifacts
```

## Capability lifecycle

```text
PROPOSED
  -> BOUNDARY_PASS
  -> PHYSICALLY_VALIDATED
  -> PROMOTED
  -> RELEASED
```

## Promotion procedure

1. Select one valuable boundary or capability.
2. Implement the minimum coherent product change and matching micro-PoC/test coverage.
3. Run static and boundary tests; record the exact PASS or FAIL.
4. Run the physical test on the target OS through the canonical deterministic session workflow whenever possible.
5. Preserve observed evidence and environment metadata exactly.
6. Define or refine the canonical semantic contract from the evidence.
7. Promote only physically validated behavior.
8. Add contract, backend, conformance, and physical-test references.
9. Release the affected contract/backend/SDK versions when the release checkpoint is approved.
10. Update RumiAI to consume the release; do not copy source snapshots into it.

FAIL and BLOCKED results remain in the laboratory and inform architecture. They are never renamed or treated as validation. Architecture follows observed behavior.

## Promotion scope

A promotion change should normally contain one capability or one tightly coherent capability family and include:

- source product commit(s);
- source PoC/test commit(s);
- boundary result;
- physical evidence session and commit;
- contract impact;
- backend implementation;
- conformance scenario;
- compatibility and security notes.

Avoid batching unrelated APIs for completeness.
