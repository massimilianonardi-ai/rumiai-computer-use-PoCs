"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app", "computer-control", "index.js"),
  "utf8"
);

const required = [
  ["desktop loader", "loadDesktopPlugin"],
  ["desktop.resolveApplication", "desktop.resolveApplication"],
  ["desktop.activateApplication", "desktop.activateApplication"],
  ["desktop.launchApplication", "desktop.launchApplication"],
  ["desktop.getForegroundApplication", "desktop.getForegroundApplication"],
  ["UI snapshot backend retained", "agentCtrl.snapshotApplication"],
  ["public getForeground facade", "getForeground,"],
];

const forbidden = [
  ["direct macosNative import/use", "macosNative"],
  ["legacy public foreground export", "getForeground:operations.getForeground"],
  ["direct switchApplication", "agentCtrl.switchApplication"],
];

let failed = false;

for (const [label, token] of required) {
  const ok = source.includes(token);
  console.log(`required ${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

for (const [label, token] of forbidden) {
  const ok = !source.includes(token);
  console.log(`forbidden ${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

console.log(`selected-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
