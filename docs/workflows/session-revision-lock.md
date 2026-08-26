# Session revision lock — implementation note

This note refines the revision-lock rule in
`docs/workflows/computer-control-development-validation-workflow.md`.

A committed session runner cannot embed its own final Git commit SHA: adding that
SHA to the runner changes the commit, creating an impossible self-reference.

The executable rule is therefore:

1. the session embeds an exact `EXPECTED_PRODUCT_SHA`;
2. the session embeds an exact `TEST_SOURCE_SHA`, the last commit containing the
   tests, fixtures and shared runner infrastructure that the session is allowed
   to exercise;
3. immediately before execution, the runner fetches `origin/main` and requires
   `PoC local HEAD == PoC origin/main`;
4. the current PoC HEAD must descend from `TEST_SOURCE_SHA`;
5. every path changed after `TEST_SOURCE_SHA` must belong to that session's own
   immutable directory;
6. the exact current PoC HEAD is recorded as `pocShaTested` in the evidence;
7. the working tree must be clean before execution.

This provides an exact, auditable test revision without a circular hash. A
session whose runner or manifest changes receives a new session ID.

Revision mismatch is a preflight `BLOCKED` condition. The runner never pulls,
rebases, force-pushes or repairs a mismatch automatically.
