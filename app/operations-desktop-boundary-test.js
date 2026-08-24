"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app", "computer-control", "operations.js"),
  "utf8"
);

const required = [
  ["desktop loader", "loadDesktopPlugin"],
  ["selected desktop plugin", "const desktop = loadDesktopPlugin()"],
  ["desktop.resolveApplication", "desktop.resolveApplication"],
  ["desktop.getForegroundApplication", "desktop.getForegroundApplication"],
  ["UI snapshot backend retained", "agentCtrl.snapshotApplication"],
  ["UI find backend retained", "agentCtrl.findElement"],
  ["UI action backend retained", "agentCtrl.fillElement"],
];

const forbidden = [
  ["direct macosNative import/use", "macosNative"],
  ["direct native identity resolution", "resolveApplicationIdentity(provider"],
  ["direct native foreground observation", "foregroundApplication()"],
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

console.log(`operations-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
