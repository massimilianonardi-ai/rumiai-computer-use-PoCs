"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(
  path.join(root, "app", "computer-control", "backends", "agent-ctrl.js"),
  "utf8"
);
const macos = fs.readFileSync(
  path.join(root, "app", "computer-control", "desktop", "plugins", "macos.js"),
  "utf8"
);
const facade = fs.readFileSync(
  path.join(root, "app", "computer-control", "index.js"),
  "utf8"
);

const requiredBackend = [
  ["backend focusWindow function", "function focusWindow(windowId)"],
  ["agent-ctrl focus-window command", "[\"focus-window\", id, \"--json\"]"],
  ["backend focusWindow export", "focusWindow,"],
];

const requiredPlugin = [
  ["window.focus capability implemented", "\"window.focus\":\"IMPLEMENTED\""],
  ["macOS focusWindow implementation", "function focusWindow(application = {}, window = {})"],
  ["stable target id requirement", "WINDOW_ID_REQUIRED"],
  ["target ownership precondition", "WINDOW_NOT_FOUND"],
  ["backend focusWindow routing", "agentCtrl.focusWindow(targetId)"],
  ["direct post-action window-list observation", "const after = agentCtrl.listWindows()"],
  ["verified focus failure", "WINDOW_FOCUS_UNVERIFIED"],
  ["target pinned postcondition", "targetAfter && targetAfter.pinned === true"],
  ["focus verification marker", "window-list-target-pinned"],
  ["focused success state", "state:\"FOCUSED\""],
];

const forbiddenPlugin = [
  ["focusWindow still deferred", "unsupported(platform, \"focusWindow\")"],
];

const focusStart = macos.indexOf("function focusWindow(application = {}, window = {})");
const focusEnd = macos.indexOf("\nfunction windowId(", focusStart);
const focusScope = focusStart >= 0 && focusEnd > focusStart
  ? macos.slice(focusStart, focusEnd)
  : "";

const requiredScope = [
  ["isolated focusWindow plugin scope", Boolean(focusScope)],
  ["no post-action plugin listWindows re-pin", !focusScope.includes("const after = listWindows(application)")],
  ["no post-action snapshotApplication re-pin", !focusScope.includes("snapshotApplication(")],
];

const forbiddenFacade = [
  ["premature public focusWindow function", "function focusWindow({app"],
  ["premature desktop.focusWindow routing", "desktop.focusWindow("],
];

let failed = false;

function checkRequired(scope, checks) {
  for (const [label, token] of checks) {
    const ok = scope.includes(token);
    console.log(`required ${label}: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) failed = true;
  }
}

function checkForbidden(scope, checks) {
  for (const [label, token] of checks) {
    const ok = !scope.includes(token);
    console.log(`forbidden ${label}: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) failed = true;
  }
}

for (const [label, ok] of requiredScope) {
  console.log(`required ${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

checkRequired(backend, requiredBackend);
checkRequired(macos, requiredPlugin);
checkForbidden(macos, forbiddenPlugin);
checkForbidden(facade, forbiddenFacade);

console.log(`window-focus-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
