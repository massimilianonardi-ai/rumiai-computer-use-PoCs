# Development workflow

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
2. Implement the minimum micro-PoC in the laboratory repository.
3. Run static and boundary tests; record the exact PASS or FAIL.
4. Run the physical test on the target OS.
5. Record observed evidence and environment metadata.
6. Define or refine the canonical semantic contract from the evidence.
7. Promote only validated behavior into this repository.
8. Add contract, backend, conformance, and physical-test references.
9. Release the affected contract/backend/SDK versions.
10. Update RumiAI to consume the release; do not copy source snapshots into it.

FAIL results remain in the laboratory and inform architecture. They are never
renamed or treated as validation. Architecture follows observed behavior.

## Pull-request scope

A promotion pull request should normally contain one capability and include:

- source PoC and commit;
- boundary result;
- physical evidence;
- contract impact;
- backend implementation;
- conformance scenario;
- compatibility and security notes.

Avoid batching unrelated APIs for completeness.
