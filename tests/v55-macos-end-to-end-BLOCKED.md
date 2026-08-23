# v55 macOS end-to-end test — BLOCKED / NOT EXECUTED

Date: 2026-08-23

## Command

```sh
git pull
./cmd/agent-ctrl-start-cu-test
```

## Observed result

The test stack started successfully on macOS ARM64:
- repository updated to the v55 boundary PASS evidence commit
- Ollama service started
- model warmup completed
- RumiAI Computer Control prompt became available
- context booted as `generic-gui -> macos`

No task was entered at the `Agent task>` prompt. The run was then cancelled.

Shutdown output included:

```text
[computer-control] runtime close warning: Error: no live daemon for session "default"
srv-stop: stopping SERVER 'ollama' ...
srv-stop: SERVER 'ollama' stopped
```

## Classification

**BLOCKED / TEST NOT EXECUTED**

This is not a v55 behavioral failure because the end-to-end task was never submitted, so the Desktop Plugin readiness path was not exercised. The runtime-close warning occurred during cancellation before any Computer Control task execution and is therefore not evidence of an end-to-end regression.

The v55 static/physical readiness-boundary test remains PASS. A new end-to-end run is required using the established v48 task:

`Fai esattamente così: crea un nuovo documento di testo, inserisci PROVA e poi cancella tutto il testo.`
