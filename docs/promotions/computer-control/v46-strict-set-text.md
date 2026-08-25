# Promotion record: v46 strict setText equality

Source laboratory: `rumiai-computer-use-PoCs`

Source evidence: `tests/v46-strict-settext-equality-PASS.md`

Validated behavior:

```text
method=ax-fill
verified=true
verification=ax-text-exact
```

The initial product promotion preserves this behavior through a transition
backend and adds a new boundary:

```text
TypeScript SDK -> local JSON-RPC -> Computer Control runtime
  -> macOS validated transition backend -> exact postcondition evidence
```

The original operation and the new end-to-end RPC path are physically validated.
On 2026-08-25 `conformance/physical-tests/macos-set-text-v46.js` obtained a fresh
TextEdit reference through `ui.snapshot` and role-based `ui.find`, then verified
strict equality through `ui.setText`.

Runtime capability discovery therefore reports `PHYSICALLY_VALIDATED` for the
tested macOS transition backend. This classification does not transfer to the
future standalone Swift backend until it passes the same conformance scenario.

The transition backend is deliberately named and must not be confused with the
future standalone Swift macOS backend.
