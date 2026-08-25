# v0.1 — Total Computer Use project separation

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Computer Use was installed by `rumiai-portable-runtime` under
`app/computer-use`, while Computer Control was loaded independently from
`lib/computer-control`.

The Computer Use source tree contained no embedded Computer Control facade,
backend, desktop plugin, native helper, or direct `agent-ctrl` import.

Observed task:

```text
Crea un nuovo documento di testo e scrivi: Separazione totale Computer Use completata.
```

Result:

```text
ACTIVATE_APP: PASS
NEW_DOCUMENT: PASS
INPUT exact verification: PASS
TASK COMPLETE: all 3 intents verified
Computer Control runtime clean shutdown: PASS
Ollama portable service clean shutdown: PASS
```
