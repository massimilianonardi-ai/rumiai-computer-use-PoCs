#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const physical = path.join(root, "physical-tests", "visual-frame-acquisition-physical.js");
const runner = path.join(root, "session-runner.sh");
const timeout = path.join(root, "run-with-timeout.js");

const physicalSource = fs.readFileSync(physical, "utf8");
const runnerSource = fs.readFileSync(runner, "utf8");
const timeoutSource = fs.readFileSync(timeout, "utf8");

assert.match(physicalSource, /finally\s*\{/);
assert.match(physicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(physicalSource, /p1a-runtime-cleanup=/);
assert.match(physicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(physicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(runnerSource, /TIMEOUT_RUNNER=/);
assert.match(runnerSource, /PHYSICAL_TIMEOUT_MS=.*45000/);
assert.match(runnerSource, /run-with-timeout\.js/);
assert.match(runnerSource, /AGENT_CTRL='\$AGENT_CTRL'/);
assert.match(timeoutSource, /detached:true/);
assert.match(timeoutSource, /process\.kill\(-child\.pid/);
assert.match(timeoutSource, /SIGTERM/);
assert.match(timeoutSource, /SIGKILL/);

console.log("perception-physical-lifecycle=PASS");
