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
  ["backend listWindows function", "function listWindows()"],
  ["agent-ctrl window-list JSON command", "[\"window-list\", \"--json\"]"],
  ["window-list windows-array validation", "Array.isArray(data?.windows)"],
  ["backend listWindows export", "listWindows,"],
];

const requiredPlugin = [
  ["window.list capability implemented", "\"window.list\":\"IMPLEMENTED\""],
  ["macOS listWindows implementation", "function listWindows(application = {})"],
  ["explicit application pin snapshot", "agentCtrl.snapshotApplication("],
  ["backend listWindows routing", "const listed = agentCtrl.listWindows()"],
  ["normalized window id", "id:String(window?.id || \"\")"],
  ["normalized window title", "title:window?.title == null ? null : String(window.title)"],
  ["normalized window process", "process:String(window?.process || \"\")"],
  ["normalized window pid", "pid:Number(window?.pid || 0)"],
  ["normalized focused state", "focused:window?.focused === true"],
  ["normalized pinned state", "pinned:window?.pinned === true"],
];

const forbiddenPlugin = [
  ["listWindows still deferred", "unsupported(platform, \"listWindows\")"],
];

const forbiddenFacade = [
  ["premature public listWindows function", "function listWindows({app}"],
  ["premature desktop.listWindows routing", "desktop.listWindows("],
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

checkRequired(backend, requiredBackend);
checkRequired(macos, requiredPlugin);
checkForbidden(macos, forbiddenPlugin);
checkForbidden(facade, forbiddenFacade);

console.log(`window-list-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
