# Computer Control — chat-driven development and physical validation workflow

## Status

This document defines the canonical operational workflow for continuing RumiAI Computer Control development and physical validation.

It replaces interactive Codex/Work development loops as the default execution model. Interactive agents may still be used when a deterministic local runner cannot exercise the required physical behavior, but they are the exception rather than the normal path.

The capability lifecycle and promotion rules remain those of `tests/products/computer-control/development-workflow.md`.

## Goal

Keep reasoning, implementation, test design, diagnosis, and fixes in the ChatGPT development conversation, while using the physical Mac as a deterministic execution environment.

The separation is:

```text
ChatGPT conversation
  -> design
  -> implement product
  -> commit product
  -> implement individual tests
  -> commit tests
  -> prepare deterministic session runner
  -> commit runner

Physical Mac
  -> verify exact expected revisions
  -> execute every test
  -> collect complete stdout/stderr and metadata
  -> write one session log + one machine-readable result
  -> commit and push evidence

ChatGPT conversation
  -> read evidence commit
  -> diagnose product/test/environment failures
  -> implement fixes
  -> prepare next immutable session
```

The physical runner executes and records. It does not redesign or repair the product.

## Repository roles

```text
massimilianonardi-ai/rumiai-computer-control
  -> standalone Computer Control product
  -> contracts, schemas, runtime, OS backends, SDKs, adapters, documentation

massimilianonardi-ai/rumiai-computer-use-PoCs
  -> laboratory
  -> micro-PoCs
  -> contract/boundary tests
  -> physical fixtures and tests
  -> session runners
  -> immutable execution evidence

RumiAI
  -> consumer of released Computer Control artifacts
```

Product changes belong in `rumiai-computer-control`.

Tests, runners, logs, and physical evidence belong in `rumiai-computer-use-PoCs`.

## Core rules

1. Product implementation and test design are performed in the ChatGPT conversation.
2. Product and test changes are committed atomically and pushed before a physical session is prepared.
3. Physical execution is deterministic, non-interactive, and script-driven whenever possible.
4. A runner never edits product source or test source.
5. A runner does not diagnose failures or invent fixes.
6. A runner does not stop at the first individual test failure.
7. Every individual test contributes its exact stdout, stderr, exit code, timing, and mechanical classification to one session evidence set.
8. Every physical session is immutable. A retry after any change receives a new session ID.
9. The runner verifies the exact expected product and PoC revisions before executing tests.
10. Physical PASS is never inferred from static/CI PASS.
11. FAIL and BLOCKED evidence is preserved; it is never rewritten into PASS.
12. Promotion to `PHYSICALLY_VALIDATED` is a distinct reviewed product change after evidence exists. The runner never changes capability status metadata.
13. Browser/WebKit fixtures do not validate native Cocoa/AppKit controls. Each physical surface must match the scope of the capability being validated.
14. No interactive Codex/Work session is required when the same evidence can be produced by a deterministic local runner.

## Development granularity

Do not necessarily wait for an entire roadmap phase before physical validation.

Create a physical checkpoint when a semantically coherent implementation block is complete and later work would otherwise build on unverified assumptions.

Examples:

```text
Phase 8
  selection observation
  -> physical checkpoint if foundational

  range selection
  -> physical checkpoint if it changes the AX model

  range mutation / insert / append
  -> physical checkpoint
```

A checkpoint should be large enough to provide meaningful integration evidence but small enough that a failure remains diagnosable.

## Step 1 — implement product in chat

For each capability or coherent capability block:

1. verify current `main` HEAD before writing;
2. inspect the canonical roadmap, schemas, SDK surface, backend, adapter, and relevant prior evidence;
3. implement the minimum coherent product change;
4. keep canonical contract, runtime, backend, SDK, adapter, and docs consistent;
5. run or rely on available static/boundary verification where appropriate;
6. create atomic product commits;
7. push product commits to `main`;
8. keep new behavior `IMPLEMENTED` until real physical evidence exists.

Preferred commit examples:

```text
feat: implement advanced text selection
fix: verify native text range mutation
refactor: expose canonical native range mapping
```

Do not combine unrelated APIs merely for roadmap completeness.

## Step 2 — implement individual tests in chat

Every product implementation must receive matching tests in `rumiai-computer-use-PoCs`.

Tests may include:

- contract tests;
- boundary tests;
- regression tests;
- native fixtures;
- physical micro-PoCs.

Each physical test should be independently executable and should emit a stable terminal marker whenever practical:

```text
<test-id>=PASS
<test-id>=FAIL
<test-id>=BLOCKED
```

The test itself may determine whether an environmental prerequisite makes execution impossible, but it must not modify product source in response.

Tests should expose enough raw evidence for later diagnosis rather than hiding backend output behind a single boolean.

Test commits are pushed before the session runner is created.

Preferred commit examples:

```text
test: add native selection observation micro-poc
test: cover text range mutation boundary
test: add AppKit range fixture
```

## Step 3 — define an immutable session

When the checkpoint is ready, create one session directory under:

```text
tests/products/computer-control/sessions/<session-id>/
```

Recommended ID form:

```text
cc-<checkpoint>-sNN
```

Examples:

```text
cc-phase8-selection-s01
cc-phase8-selection-s02
cc-phase9-app-lifecycle-s01
```

A new session ID is mandatory when:

- product source changed;
- test source changed;
- fixture source changed;
- runner behavior changed materially;
- the expected product SHA changed;
- the expected PoC SHA changed.

Never overwrite the log/result of an earlier session.

## Step 4 — session runner

The committed session contains at least:

```text
tests/products/computer-control/sessions/<session-id>/run.sh
```

It may also contain a static manifest if useful:

```text
tests/products/computer-control/sessions/<session-id>/session-manifest.json
```

The runner is part of the test code and is committed before physical execution.

### Runner responsibilities

The runner must:

1. run non-interactively;
2. use `set -u` and explicit error handling rather than fail-fast behavior that aborts after the first test;
3. resolve the portable runtime paths deterministically;
4. verify OS/platform prerequisites relevant to the session;
5. verify the test repository is on the expected branch;
6. verify the local test repository HEAD equals the expected PoC SHA;
7. `git fetch origin main` and verify `origin/main` equals that same expected PoC SHA before testing;
8. verify the product checkout HEAD equals the expected product SHA;
9. verify the product working tree and test working tree are clean before execution, except for runner-generated evidence after execution begins;
10. capture environment versions needed to interpret results;
11. execute every listed test even if one or more tests fail;
12. record each test command exactly;
13. record test start/end timestamps and duration;
14. capture each test's complete stdout;
15. capture each test's complete stderr;
16. record each test exit code;
17. mechanically classify the test without diagnosing the cause;
18. perform cleanup that does not erase evidence;
19. produce one human-readable session log;
20. produce one machine-readable session result;
21. stage only the expected generated evidence files;
22. create one evidence commit;
23. push that evidence commit to `origin/main`.

### Runner non-responsibilities

The runner must not:

- modify product source;
- modify committed test/fixture source;
- patch dependencies;
- promote capability metadata;
- infer architectural causes;
- retry by silently changing parameters until a test passes;
- delete or rewrite earlier evidence;
- use `git add -A` or otherwise stage unrelated working-tree changes;
- automatically pull/rebase to a different revision and continue testing.

If the expected revision does not match, the runner must stop before the test body because the intended checkpoint is not being exercised.

## Step 5 — preflight revision lock

Every session runner embeds or loads two exact revisions:

```text
EXPECTED_PRODUCT_SHA=<40-char SHA>
EXPECTED_POC_SHA=<40-char SHA>
```

The physical run is meaningful only when:

```text
product local HEAD == EXPECTED_PRODUCT_SHA
PoC local HEAD == EXPECTED_POC_SHA
PoC origin/main == EXPECTED_POC_SHA
```

The runner must not repair a mismatch itself.

A mismatch is a preflight BLOCKED condition and no product test should run.

If the Git repository itself is at the wrong revision, do not create an evidence commit on that unexpected revision. Print the mismatch clearly so the checkpoint can be corrected first.

## Step 6 — evidence format

A successful execution creates two generated files in the session directory:

```text
tests/products/computer-control/sessions/<session-id>/session.log
tests/products/computer-control/sessions/<session-id>/session-result.json
```

### `session.log`

This is the complete human-readable evidence.

It should begin with a session header containing at least:

```text
session id
start/end time
overall duration
hostname / OS version / architecture
product repository path
product expected SHA
product observed SHA
PoC repository path
PoC expected SHA
PoC observed SHA
Node version
agent-ctrl version
other runtime/tool versions relevant to the checkpoint
```

Each test has an explicit section:

```text
================================================================================
TEST: <test-id>
COMMAND: <exact command>
START: <timestamp>
--------------------------------------------------------------------------------
STDOUT
--------------------------------------------------------------------------------
<complete stdout>
--------------------------------------------------------------------------------
STDERR
--------------------------------------------------------------------------------
<complete stderr>
--------------------------------------------------------------------------------
EXIT_CODE: <n>
DURATION_MS: <n>
RESULT: PASS|FAIL|BLOCKED
END: <timestamp>
================================================================================
```

Do not truncate stdout or stderr.

Do not replace raw output with a summary.

### `session-result.json`

This provides machine-readable indexing without replacing the raw log.

Recommended structure:

```json
{
  "sessionId": "cc-phase8-selection-s01",
  "startedAt": "...",
  "endedAt": "...",
  "productShaExpected": "...",
  "productShaObserved": "...",
  "pocShaExpected": "...",
  "pocShaObserved": "...",
  "environment": {},
  "tests": [
    {
      "id": "...",
      "command": "...",
      "exitCode": 0,
      "durationMs": 0,
      "result": "PASS"
    }
  ],
  "summary": {
    "pass": 0,
    "fail": 0,
    "blocked": 0,
    "total": 0,
    "overall": "PASS"
  }
}
```

The JSON contains metadata and classifications. It does not duplicate all stdout/stderr.

## Step 7 — mechanical result classification

The runner classifies; it does not diagnose.

Preferred per-test rule:

1. if the test emits an explicit canonical terminal marker, use that marker;
2. otherwise exit code `0` means `PASS`;
3. otherwise a non-zero exit code means `FAIL` unless the test explicitly reports `BLOCKED`.

Recommended overall precedence:

```text
any FAIL          -> overall FAIL
else any BLOCKED  -> overall BLOCKED
else all PASS     -> overall PASS
```

A test must never be labeled PASS because some earlier test for the same API passed.

## Step 8 — non-fail-fast execution

Individual test failure must not terminate the session.

The purpose of one physical session is to obtain the fullest possible snapshot of the checkpoint in one Mac execution.

Therefore:

```text
test A PASS
  -> continue

test B FAIL
  -> record complete evidence
  -> continue

test C BLOCKED
  -> record complete evidence
  -> continue when the blocking condition is test-local

test D PASS
  -> continue
```

Only a session-wide prerequisite failure, such as wrong SHAs or inability to access the required runtime, may prevent the entire test list from running.

## Step 9 — automatic evidence commit

After all tests complete, the runner creates exactly one evidence commit for that session.

Preferred commit message:

```text
test: record <session-id> evidence
```

The runner stages only:

```text
session.log
session-result.json
```

plus another explicitly declared generated evidence file only when the session contract requires it.

The runner then pushes the commit to `origin/main`.

If the push is rejected because `origin/main` changed after preflight:

- do not force push;
- preserve the local evidence commit;
- print the local commit SHA and push failure clearly;
- report the session as evidence-created but not published;
- let the ChatGPT conversation decide how to reconcile it.

## Step 10 — commands given to the user

The normal user interaction should remain minimal.

Preferred invocation:

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc
./tests/products/computer-control/sessions/<session-id>/run.sh
```

If execute permission cannot be relied upon:

```bash
cd /Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc
/bin/bash tests/products/computer-control/sessions/<session-id>/run.sh
```

The runner itself owns the rest of the physical session.

The user should not need to manually copy logs, classify results, or edit files.

## Step 11 — chat analysis after the physical commit

After the user reports that the evidence commit is complete, the ChatGPT development conversation:

1. verifies current product and PoC repository HEADs;
2. locates the new evidence commit;
3. reads `session-result.json`;
4. reads the complete relevant sections of `session.log`;
5. classifies each problem as primarily product, test/fixture, environment, or inconclusive;
6. preserves the evidence exactly as committed;
7. fixes product source where required;
8. fixes tests/fixtures where required;
9. adds regression coverage for each discovered defect;
10. commits and pushes each coherent fix atomically;
11. creates a new session ID with new expected SHAs;
12. commits and pushes the new runner;
13. gives the user the next shell invocation.

No previous evidence file is amended.

## Step 12 — failure-first record

A failed physical run is useful evidence and remains in Git history.

The cycle is:

```text
session s01
  -> FAIL evidence commit
  -> diagnosis in chat
  -> product/test fix commits

session s02
  -> FAIL or BLOCKED evidence commit
  -> diagnosis in chat
  -> fixes

session s03
  -> PASS evidence commit
```

The final PASS does not erase s01/s02.

This provides an auditable explanation for every implementation change caused by physical behavior.

## Step 13 — physical PASS and promotion

A physical PASS proves only the behavior and environment actually covered by that session.

After PASS:

1. inspect the test matrix and determine exactly which capabilities were physically proved;
2. create a distinct product commit to promote only those capabilities to `PHYSICALLY_VALIDATED` when appropriate;
3. cite the exact evidence commit/session ID in the promotion documentation;
4. rerun static/contract checks for the metadata change;
5. do not promote untested variants merely because they share an API name.

Promotion is not performed by the session runner.

## Session source/evidence commit pattern

A typical sequence is:

```text
PRODUCT
  feat: implement capability X
  fix: ...                         # only if static/boundary work finds an issue

POC
  test: add capability X tests
  test: prepare cc-capability-x-s01

PHYSICAL MAC
  test: record cc-capability-x-s01 evidence

CHATGPT DIAGNOSIS
  PRODUCT: fix: correct X native mapping
  POC:     test: cover X native mapping regression
  POC:     test: prepare cc-capability-x-s02

PHYSICAL MAC
  test: record cc-capability-x-s02 evidence
```

## Concurrency rule

Once a session runner has been committed and handed to the user for physical execution, avoid advancing the PoC `main` branch from the ChatGPT conversation until the runner has committed/pushed its evidence, unless the session is explicitly abandoned.

This keeps the runner's `EXPECTED_POC_SHA`, its preflight check, and its automatic push deterministic.

Product `main` should likewise remain at the expected physical checkpoint until that session completes unless the run is abandoned and a new session is prepared.

## Local environment principle

Computer Control physical validation uses the portable runtime and must not silently introduce global/profile/system installations.

Current macOS portable layout is typically:

```text
/Volumes/RumiAI/rumiai-portable-runtime
/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control
/Volumes/RumiAI/rumiai-portable-runtime/test/computer-use-poc
/Volumes/RumiAI/rumiai-portable-runtime/bin/nodejs/bin/node
/Volumes/RumiAI/rumiai-portable-runtime/bin/agent-ctrl
```

Session runners should resolve these paths from their known repository location where practical, while allowing explicit environment overrides when required.

## Interactive Codex/Work exception

Interactive Codex/Work remains available when a test cannot reasonably be made deterministic, for example when:

- GUI state requires exploratory inspection before a stable fixture can be built;
- an OS permission surface cannot be exercised from the runner context;
- a new backend exposes behavior that must first be discovered interactively;
- the physical failure cannot be reproduced or explained from complete runner logs.

When interactive investigation discovers the missing behavior, convert the result into a deterministic regression test and return to this workflow as soon as possible.

Do not use an interactive agent merely to execute a test suite that a shell runner can execute and record.

## Relationship to completed native AppKit validation

The completed native Cocoa/AppKit Phase 3–7 validation is preserved at:

```text
tests/products/computer-control/handoffs/2026-08-26-native-appkit-physical-validation-completed.md
```

That validation demonstrated the value of failure-first physical evidence, but required multiple interactive Codex iterations. This workflow keeps the same evidence discipline while moving implementation, diagnosis, and test evolution back into the ChatGPT development conversation and reducing the physical Mac role to deterministic execution and recording.

## Operational summary

```text
IMPLEMENT IN CHAT
  -> COMMIT PRODUCT
  -> WRITE INDIVIDUAL TESTS IN CHAT
  -> COMMIT TESTS
  -> PREPARE IMMUTABLE SESSION RUNNER
  -> COMMIT RUNNER
  -> USER RUNS ONE SHELL SESSION
  -> RUNNER EXECUTES ALL TESTS
  -> RUNNER SAVES COMPLETE STDOUT + STDERR
  -> RUNNER WRITES session-result.json
  -> RUNNER COMMITS + PUSHES EVIDENCE
  -> USER REPORTS COMPLETION
  -> CHAT READS EVIDENCE
  -> CHAT FIXES PRODUCT/TESTS
  -> NEW IMMUTABLE SESSION
```

This is the default Computer Control development and physical-validation workflow from this point forward.
