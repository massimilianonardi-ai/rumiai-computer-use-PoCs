# Embedded macOS source provenance

The initial embedded implementation was promoted mechanically from:

```text
repository: massimilianonardi-ai/rumiai-computer-use-PoCs
source commit: 0f65395398670ea5f06e1674741e3a6ba9de815b
promotion date: 2026-08-25
```

Promoted scope:

- Computer Control facade and operations;
- macOS desktop plugins through v82;
- native macOS observation and window helpers;
- Provider Registry entries;
- Swift helper sources for focused-window observation, AX manual accessibility,
  minimized state, and bounds mutation.

The third-party `agent-ctrl` executable is not tracked. The locally validated
binary used during extraction had SHA-256:

```text
68b3a6a17b068d2a5ddbc39a422c84fdb21cd620059ed913b0469ada61bc3378
```

Later changes in this directory belong to the standalone Computer Control
project and no longer inherit automatically from the laboratory repository.
