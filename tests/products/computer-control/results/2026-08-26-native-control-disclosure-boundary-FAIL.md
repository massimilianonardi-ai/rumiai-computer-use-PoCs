# Native disclosure controls — boundary result

Result: **FAIL**

Product commit checked out by CI: `450476d6008cde5d3dafbd332f30b5beeb54b8f5`
PoC commit: `ad614c91221657379f0f219b82bd96da0a870b2c`
GitHub Actions run: `32947027961`

Exact summary:

```text
Computer Use boundary: PASS
Computer Control structure: PASS
Computer Control contract: FAIL
20 tests
16 pass
4 fail
```

Failures:
- existing source-surface checks for `ControlDescription`, `InvokeResult`, and `ToggleResult` no longer found those declarations directly in `index.d.ts` after type layering;
- the new disclosure router fixture omitted the `info()` method required by the existing core router constructor.

The failures are boundary/test-contract issues, not physical evidence. `ui.expand` and `ui.collapse` remain `IMPLEMENTED` and unvalidated physically.
