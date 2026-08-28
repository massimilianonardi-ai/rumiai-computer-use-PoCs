#!/usr/bin/env node
"use strict";

const {spawn} = require("node:child_process");

const timeoutMs = Number(process.argv[2]);
const command = process.argv[3];
const args = process.argv.slice(4);

if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || !command) {
  console.error("run-with-timeout: usage: <timeout-ms> <command> [args...]");
  process.exit(2);
}

const child = spawn(command, args, {
  stdio:"inherit",
  env:process.env,
  detached:true,
});

let timedOut = false;
let forceTimer = null;

function killGroup(signal) {
  try { process.kill(-child.pid, signal); } catch (_) {}
}

const timer = setTimeout(() => {
  timedOut = true;
  console.error(`PROCESS_TIMEOUT timeoutMs=${timeoutMs}`);
  killGroup("SIGTERM");
  forceTimer = setTimeout(() => killGroup("SIGKILL"), 2000);
}, timeoutMs);

child.on("error", error => {
  clearTimeout(timer);
  if (forceTimer) clearTimeout(forceTimer);
  console.error(`PROCESS_START_FAILED detail=${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (forceTimer) clearTimeout(forceTimer);
  if (timedOut) process.exit(124);
  if (signal) {
    console.error(`PROCESS_SIGNALLED signal=${signal}`);
    process.exit(1);
  }
  process.exit(code == null ? 1 : code);
});
