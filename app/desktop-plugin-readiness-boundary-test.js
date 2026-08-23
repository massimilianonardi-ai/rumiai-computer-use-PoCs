"use strict";

const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

const source = ComputerControl.ensureReady.toString();
const desktop = loadDesktopPlugin();

const required = [
  "desktop.resolveApplication",
  "desktop.activateApplication",
  "desktop.launchApplication",
  "desktop.getForegroundApplication",
  "agentCtrl.snapshotApplication",
];

const forbidden = [
  "macosNative.resolveApplicationIdentity",
  "macosNative.launchApplicationBundle",
  "agentCtrl.switchApplication",
  "operations.getForeground",
];

let failed = false;

for (const token of required) {
  const present = source.includes(token);
  console.log(`required ${token}: ${present ? "PASS" : "FAIL"}`);
  if (!present) failed = true;
}

for (const token of forbidden) {
  const absent = !source.includes(token);
  console.log(`forbidden ${token}: ${absent ? "PASS" : "FAIL"}`);
  if (!absent) failed = true;
}

console.log(`selected=${desktop.id} platform=${process.platform}`);
console.log(`boundary=${failed ? "FAIL" : "PASS"}`);

process.exitCode = failed ? 1 : 0;
