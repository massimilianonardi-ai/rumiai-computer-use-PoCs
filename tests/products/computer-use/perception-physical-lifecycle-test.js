#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const physical = path.join(root, "physical-tests", "visual-frame-acquisition-physical.js");
const p2bPhysical = path.join(root, "physical-tests", "perception-p2b-provider-contract-public.js");
const p3aPhysical = path.join(root, "physical-tests", "perception-p3a-target-resolution-public.js");
const p3bPhysical = path.join(root, "physical-tests", "perception-p3b-action-policy-public.js");
const p4Physical = path.join(root, "physical-tests", "perception-p4-action-execution-public.js");
const runner = path.join(root, "session-runner.sh");
const timeout = path.join(root, "run-with-timeout.js");

const physicalSource = fs.readFileSync(physical, "utf8");
const p2bPhysicalSource = fs.readFileSync(p2bPhysical, "utf8");
const p3aPhysicalSource = fs.readFileSync(p3aPhysical, "utf8");
const p3bPhysicalSource = fs.readFileSync(p3bPhysical, "utf8");
const p4PhysicalSource = fs.readFileSync(p4Physical, "utf8");
const runnerSource = fs.readFileSync(runner, "utf8");
const timeoutSource = fs.readFileSync(timeout, "utf8");

assert.match(physicalSource, /finally\s*\{/);
assert.match(physicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(physicalSource, /p1a-runtime-cleanup=/);
assert.match(physicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(physicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(p2bPhysicalSource, /finally\s*\{/);
assert.match(p2bPhysicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(p2bPhysicalSource, /p2b-runtime-cleanup=/);
assert.match(p2bPhysicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(p2bPhysicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(p3aPhysicalSource, /finally\s*\{/);
assert.match(p3aPhysicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(p3aPhysicalSource, /p3a-runtime-cleanup=/);
assert.match(p3aPhysicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(p3aPhysicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(p3bPhysicalSource, /finally\s*\{/);
assert.match(p3bPhysicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(p3bPhysicalSource, /p3b-runtime-cleanup=/);
assert.match(p3bPhysicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(p3bPhysicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(p4PhysicalSource, /finally\s*\{/);
assert.match(p4PhysicalSource, /computerControl\.shutdownRuntime\(\)/);
assert.match(p4PhysicalSource, /p4-test-cleanup=/);
assert.match(p4PhysicalSource, /movePointer\(/);
assert.match(p4PhysicalSource, /process\.exitCode\s*=/);
assert.doesNotMatch(p4PhysicalSource, /function fail[\s\S]*process\.exit\(/);

assert.match(runnerSource, /TIMEOUT_RUNNER=/);
assert.match(runnerSource, /PHYSICAL_TIMEOUT_MS=.*45000/);
assert.match(runnerSource, /run-with-timeout\.js/);
assert.match(runnerSource, /AGENT_CTRL='\$AGENT_CTRL'/);
assert.match(timeoutSource, /detached:true/);
assert.match(timeoutSource, /process\.kill\(-child\.pid/);
assert.match(timeoutSource, /SIGTERM/);
assert.match(timeoutSource, /SIGKILL/);

console.log("perception-physical-lifecycle=PASS");
