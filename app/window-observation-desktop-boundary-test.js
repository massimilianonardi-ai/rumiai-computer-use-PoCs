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
  ["selected desktop plugin", "const desktop = loadDesktopPlugin()"],
  ["public getCurrentWindow facade", "function getCurrentWindow"],
  ["desktop.getCurrentWindow", "desktop.getCurrentWindow"],
  ["provider resolution retained", "resolveApplicationProvider(app)"],
  ["desktop application resolution retained", "resolveDesktopApplication(provider)"],
  ["public getCurrentWindow export", "getCurrentWindow,"],
];

const forbidden = [
  ["legacy operations.getCurrentWindow export", "getCurrentWindow:operations.getCurrentWindow"],
  ["direct agentCtrl.getCurrentWindow in facade", "agentCtrl.getCurrentWindow"],
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

console.log(`window-observation-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
