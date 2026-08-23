# Computer Use contexts — micro-PoC

This directory intentionally contains **data**, not executable code.

The current experiment validates one idea only:

> before planning a task, Computer Use selects a small hierarchy of relevant
> operational contexts and injects only those contexts into the planner.

Current hierarchy:

- `generic-gui` — always active
- `macos` — always active in this macOS PoC
- `system-settings` — selected only when the task concerns System Settings

A context currently contains:

- scope
- trigger
- competence level/confidence
- compact knowledge
- planning rules

Contexts do **not** yet modify executors, resolver, recovery or agent-ctrl.
That is deliberate: this micro-PoC only tests context selection + planner use.

Primary validation task:

    Open System Settings, search for Bluetooth, then open the Bluetooth result.

Expected selection:

    generic-gui -> macos -> system-settings

Expected plan if the context is used correctly:

    ACTIVATE_APP("System Settings")
    SEARCH("Bluetooth")
    OPEN("Bluetooth")

`OPEN_RESULT(1)` should remain reserved for explicitly ordinal requests such as:

    Open Safari, search for OpenAI, then open the first result.
## Planner payload compression

The JSON files may retain readable knowledge, scope and competence metadata.
Only `planner_delta` is injected into the LLM planner prompt. This keeps the
active operational context small and treats each specialized context as a
delta over the general planner semantics. Empty deltas remain selected for
context hierarchy/logging but add zero planner tokens.

