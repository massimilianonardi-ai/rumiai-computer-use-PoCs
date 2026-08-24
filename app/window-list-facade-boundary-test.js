"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const facade = fs.readFileSync(
  path.join(root, "app", "computer-control", "index.js"),
  "utf8"
);
const macos = fs.readFileSync(
  path.join(root, "app", "computer-control", "desktop", "plugins", "macos.js"),
  "utf8"
);

const requiredFacade = [
  ["public listWindows function", "function listWindows({app} = {})"],
  ["provider resolution retained", "resolveApplicationProvider(app)"],
  ["desktop application resolution retained", "resolveDesktopApplication(provider)"],
  ["desktop.listWindows routing", "desktop.listWindows(desktopResolved.application)"],
  ["windows array validation", "Array.isArray(observed.windows)"],
  ["public listWindows export", "listWindows,"],
  ["observed state", "state:\"OBSERVED\""],
];

const forbiddenFacade = [
  ["direct agentCtrl.listWindows in facade", "agentCtrl.listWindows()"],
  ["direct window-list command in facade", "window-list --json"],
  ["direct plugin backend details in facade", "snapshotApplication("],
];

const requiredPlugin = [
  ["validated window.list capability retained", "\"window.list\":\"IMPLEMENTED\""],
  ["macOS listWindows retained", "function listWindows(application = {})"],
  ["backend listWindows routing retained", "agentCtrl.listWindows()"],
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

checkRequired(facade, requiredFacade);
checkForbidden(facade, forbiddenFacade);
checkRequired(macos, requiredPlugin);

console.log(`window-list-facade-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
