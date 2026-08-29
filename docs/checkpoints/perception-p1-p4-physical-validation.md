# Checkpoint — Computer Use perception P1–P4 physical validation

Date: 2026-08-29

This checkpoint records the immutable physical-validation trail for the first Computer Use visual fallback path. Product architecture and the next orchestration phase are documented in `rumiai-computer-use/docs/perception.md`, `docs/handoff.md`, and `docs/orchestration-visual-fallback.md` in the product repository.

## Authoritative dependency

Computer Control runtime used by the final stack:

```text
e3a3f13d66546cf8f0fca50075bd4607c2c3d003
```

Its Phase 10A–10E mechanics are physically validated. Computer Use does not own a second capture/input backend.

## Authoritative sessions

| Stage | Session | Evidence commit | Result | Validated Computer Use runtime / role |
|---|---|---|---|---|
| P1A | `cu-perception-p1a-visual-frame-acquisition-s04` | `bdb4de64ea4471838e878a385e2f1f2b7f538ae7` | PASS | `322b5cdf3d7003a64910fcc46927225405150213` |
| P1B discovery | `cu-perception-p1b-coordinate-mapping-discovery-s02` | `89ef1c1b0b2ddab7de2c8e35bd9dca2d88fb7a57` | PASS | physical mapping discovery |
| P1B public | `cu-perception-p1b-mapped-frame-public-s02` | `09692cd9b16eb36a10bb0ee294162b901afcfd17` | PASS | `29c269864def0a26d3254e913d2a5a87f6125103` |
| P2A | `cu-perception-p2a-local-ocr-discovery-s02` | `9bf876dd35190776b9276d1e98db9e16733b5c50` | PASS | local macOS Vision PoC discovery; product then `a47ada40d6c01dc703c745dc22d046329fe34aea` |
| P2B | `cu-perception-p2b-provider-contract-public-s02` | `82ca0c0d1fb383a3102d19238cfe885cd0b8d8a4` | PASS | `839d53d100e31da2fec839351f94f197d377ab36` |
| P3A | `cu-perception-p3a-target-resolution-public-s01` | `c2a1e704f99b5cf528fb15287a785875c454a400` | PASS | `32a49d08bd235e906b992e093e2184144f76136c` |
| P3B | `cu-perception-p3b-action-policy-public-s01` | `3ba45950619a9e3cf9249b830609e7ca9ccd9faf` | PASS, 11/11 | `a8f85143ae77ba79e4fb47a0931697714df908b6` |
| P4 | `cu-perception-p4-action-execution-public-s01` | `cd86381d05bb7fcbda91ebe77ff8d8806ee827fa` | PASS, 12/12 | `5dc3607ff18b20ab806b9bf455b68f962a005e9f` |

P4 exact locks:

```text
Computer Use runtime  5dc3607ff18b20ab806b9bf455b68f962a005e9f
Computer Control      e3a3f13d66546cf8f0fca50075bd4607c2c3d003
TEST_SOURCE_SHA        6c776dc0f811835850ccf3933b9b247364f8c1a3
PoC SHA tested         9218a63b115a9cfb61bc7a091eb7e532aa8a7072
Evidence commit        cd86381d05bb7fcbda91ebe77ff8d8806ee827fa
Result                 12 PASS / 0 FAIL / 0 BLOCKED
```

## What P4 physically proved

The final test-owned macOS fixture exercised the real chain:

```text
mapped capture
→ local Vision PoC provider through provider-neutral P2B
→ exact-text P3A target
→ explicit P3B authorization
→ real Computer Control clickPointer
→ CLICK_POSTED
→ fresh independent visual capture
→ exact-text postcondition
→ VERIFIED_SUCCESS
```

The postcondition was absent before the action and present after the action. `CLICK_POSTED` itself retained `semanticConsequenceVerified = false`. Only the new post-action observation justified `taskOutcome.state = VERIFIED_SUCCESS`.

The run also verified pointer restoration, fixture cleanup, Computer Control runtime shutdown, clean product trees, no screenshot/OCR text/coordinate persistence, and bounded physical-process lifecycle.

## Important preserved failures / interrupted history

These are useful diagnostics and must remain immutable.

### P1A s01 — FAIL

Evidence: `7878c9459f1dacec6ccb464bd73a1830028310c0`.

Cause: new Computer Use physical runner did not pass portable `AGENT_CTRL`; real capture path stopped at `BACKEND_UNAVAILABLE`. Product was not at fault. Fixed forward in PoC runner.

### P1A s02 — INTERRUPTED

The capture process retained the spawned Computer Control runtime child, so Node did not exit after the physical test. The run was manually interrupted. Generated evidence was preserved outside the working tree. Fixed forward by explicit runtime shutdown and a 45-second process-group watchdog.

### P1A s03 — FAIL with physical capture PASS

Evidence: `565efbe7e252f56db65f3bd3c85dae09acfabc7f`.

The physical acquisition itself passed; a static PoC guard used a wrong path and produced the global FAIL. s04 is authoritative.

### P1B discovery s01 — FAIL

Evidence: `963418fdc2c6be388fd687ec22273e6abc7573a4`.

Initial marker detection was too dependent on absolute RGB values and a stale documentation guard also failed. Fixed forward using robust marker rendering/detection. s02 is authoritative.

### P2A s01 — FAIL

Evidence: `508996e81e8c100412019dbbf18ad294eb179356`.

The run failed at `FIXTURE_COMPILE_FAILED` before OCR. Swift fixture/helper syntax was normalized; s02 is authoritative.

### P2B s01 — FAIL with P2B physical PASS

Evidence: `d24a8fa25289074f989c2f26777d5ad06045b731`.

P2B contract and physical test both passed. The only global failure was a stale P1A documentation guard that incorrectly assumed the whole perception document still contained no OCR. s02 is authoritative.

## Test workflow invariants

For subsequent P5 work preserve the existing session discipline:

1. product changes first;
2. freeze exact Computer Use product SHA and Computer Control dependency SHA;
3. implement contract + physical tests in PoC;
4. freeze exact `TEST_SOURCE_SHA` before adding session runner/manifest;
5. after test-source, add only session-specific runner + manifest;
6. physical runner preflights clean product trees, exact refs, portable `AGENT_CTRL`, Darwin host and ancestry/path constraints;
7. physical test runs through the 45-second process-group watchdog;
8. evidence is committed and pushed even for FAIL/BLOCKED where possible;
9. inspect the immutable evidence commit before product promotion;
10. never force, reset or delete historical evidence.

## Current next checkpoint

P1–P4 are complete. Do not create P3B/P4 reruns merely because an older chat transcript ends before those sessions; the repository evidence above is authoritative.

The next test program is **P5A — visual fallback coordinator** as defined in `rumiai-computer-use/docs/orchestration-visual-fallback.md`.

P5A should first validate product composition of P1B → P2B → P3A → P3B → P4 with an injected provider and deterministic target/action/postcondition. It must not yet modify planner semantics or silently attach visual fallback to every executor failure.
