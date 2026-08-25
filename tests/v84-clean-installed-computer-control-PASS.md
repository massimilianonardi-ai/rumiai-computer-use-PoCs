# v84 — Clean installed Computer Control

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

The RumiAI external wrapper no longer contains a development-volume path. It
resolves an explicit adapter, `RUMIAI_COMPUTER_CONTROL_HOME`, or the versioned
installation inside RumiAI at `$ROOT/bin/rumiai-computer-control/current`.

Computer Control `v0.8.0` was installed into an empty temporary prefix. RumiAI
loaded the adapter from that installed tree and observed:

```text
external wrapper has no development-volume path: PASS
rumiai-installed-adapter=PASS
installed-contract-version=PASS
installed-runtime-version=PASS
installed-runtime-path-clean=PASS
physical-rumiai-external-adapter=PASS
RumiAI NEW_DOCUMENT: PASS
RumiAI INPUT exact verification: PASS
TASK COMPLETE: all 2 intents verified
external runtime clean shutdown: PASS
user-profile installation refusal: PASS
portable default resolution from RumiAI/bin: PASS
no Computer Control artifacts under ~/.local: PASS
```
