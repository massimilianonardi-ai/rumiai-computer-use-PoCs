# macOS clean installation v0.8.0

Date: 2026-08-25

Status: `PHYSICALLY_VALIDATED`

Release: `v0.8.0`

The installer was executed from the repository with an explicit portable root
inside a newly created empty project fixture under `/tmp`. It downloaded the
public `agent-ctrl` v0.1.4 Apple Silicon
asset, verified the pinned SHA-256 digest, compiled all four Swift helpers, and
created the versioned installation plus a stable project-local `current` link.

The validation used only the installed tree for Computer Control source and
produced:

```text
agent-ctrl 0.1.4
rumiai-computer-control=PASS
physical-rumiai-external-adapter=PASS
installed-contract-version=PASS
installed-runtime-version=PASS
installed-runtime-path-clean=PASS
RumiAI NEW_DOCUMENT from installed runtime=PASS
RumiAI INPUT exact verification from installed runtime=PASS
RumiAI clean shutdown=PASS
```

RumiAI resolved this installation through `RUMIAI_COMPUTER_CONTROL_HOME`. The
reported runtime path was inside the clean prefix and contained no development
volume path.

The final consumer regression also resolved the default portable installation
from `RumiAI/bin/rumiai-computer-control/current` without an environment
override. User-profile installation refusal and absence of Computer Control
artifacts under `~/.local` were verified.
