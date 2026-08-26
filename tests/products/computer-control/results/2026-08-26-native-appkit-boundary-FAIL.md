# Native AppKit revalidation boundary — FAIL

- Date: 2026-08-26
- GitHub Actions run: `32975863872`
- PoC commit: `b93d50b90df083cf2376409ae7371beab82901f1`
- Product commit checked out by CI: `1720411009867b0a6e55fcbca18136e284a572d8`
- Structure check: **PASS**
- Contract tests: **25 PASS / 2 FAIL**

## FAIL 1 — product syntax

`backends/macos/runtime/app/computer-control/native-tree.js` contains invalid JavaScript optional-property syntax in `normalizeRef`:

```text
raw?.0
```

Node 22 reports `SyntaxError: Unexpected token ')'` while loading `native-controls-children.test.js`.

Classification: **PRODUCT_DEFECT**. Correct syntax without changing intended semantics.

## FAIL 2 — scroll boundary fixture

`scrollIntoView uses native action plus geometry rather than visible flag` expected a non-idempotent verification method matching `native-geometry|ax-scroll-to-visible`, but observed:

```text
native-scroll-area-geometry
```

The fixture initialized the synthetic target inside the scroll-area before the call, so the product correctly took its idempotent geometry branch. The test setup, not the product behavior, was inconsistent with the scenario name.

Classification: **POC_HARNESS_DEFECT**. Initialize the target outside the viewport, let the synthetic native scroll-to-visible action move it inside, then assert the post-action geometry method.

Both failures are preserved here before any corrective commit, per the laboratory workflow.
