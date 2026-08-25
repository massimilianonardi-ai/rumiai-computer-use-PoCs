# Changelog

## 0.8.0 — 2026-08-25

- Add the synchronous RumiAI compatibility adapter over the standalone SDK and socket runtime.
- Normalize legacy key arrays into canonical keyboard chords.
- Recover safely from stale runtime sockets between consumer sessions.
- Route all four high-level RumiAI consumers through the external project boundary.
- Physically validate a complete RumiAI task and clean runtime shutdown.
- Add a versioned macOS installer with verified backend download and compiled native helpers.
- Remove the development-volume path from RumiAI adapter resolution.
- Require an explicit project-local portable root and reject system/user-profile installation paths.

## 0.7.0 — 2026-08-25

- Extract the validated macOS v82 source into the standalone repository.
- Embed Provider Registry entries, desktop plugins, and Swift helper sources.
- Remove all runtime source paths to `rumiai-computer-use-PoCs`.
- Keep the third-party `agent-ctrl` executable as an untracked installed dependency.
- Revalidate both core and window physical suites using only the standalone tree.

## 0.6.0 — 2026-08-25

- Add the complete macOS v82 window matrix behind local RPC.
- Add safe list/current/focus/close/minimize/restore/maximize/move/resize.
- Canonicalize window descriptors and `{x,y,width,height}` geometry.
- Normalize the legacy current-window wrapper at the adapter boundary.
- Physically validate all window operations and geometry restoration.

## 0.5.0 — 2026-08-25

- Add `sync.waitStable` and `sync.waitUntilChanged`.
- Preserve equivalent compact/full representations during delta comparison.
- Physically validate change and stability synchronization around clear/paste.

## 0.4.0 — 2026-08-25

- Add `ui.focus`, `ui.click`, `ui.press`, and strict `ui.clear`.
- Add clipboard read, verified write, copy, and paste.
- Distinguish delivered input from caller-owned semantic consequences.
- Physically validate interaction and clipboard behavior on TextEdit.

## 0.3.0 — 2026-08-25

- Separate runtime readiness from application readiness.
- Add `application.ensureReady` and `application.getForeground`.
- Add `ui.get` and `ui.getBounds`.
- Correct transport decoding for quoted AX scalar values.
- Physically validate the complete application and observation boundary.

## 0.2.0 — 2026-08-25

- Add `ui.snapshot` observation.
- Add normalized `ui.find` by semantic query or role.
- Return structured actionable nodes from snapshots.
- Physically validate `runtime.info → ui.snapshot → ui.find → ui.setText` on macOS.
- Promote the TypeScript SDK and macOS transition backend to `0.2.0`.

## 0.1.0 — 2026-08-25

- Create standalone repository architecture.
- Add local JSON-RPC runtime and TypeScript SDK.
- Add strict verified `ui.setText` transition backend boundary.
