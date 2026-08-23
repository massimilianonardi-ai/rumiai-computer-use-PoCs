# v53 — Platform-Aware Context Selection — Linux ARM64 first test

**Date:** 2026-08-23
**Status:** BLOCKED / TEST NOT EXECUTED
**Environment:** Ubuntu 26.04 ARM64 VM

## Attempted test

The context-selection test was invoked with the bare command `node` from the interactive shell after `git pull`.

Observed result:

```text
Comando «node» non trovato, ma può essere installato con:
sudo apt install nodejs
```

## Classification

This does not exercise v53 and is not a Context Manager failure.

RumiAI installs Node.js locally under the repository (`bin/nodejs/bin/node`); the interactive login shell is not expected to have that project-local binary on its global PATH.

The next test must invoke the already installed project-local Node.js binary directly. No source change is required before retesting.
