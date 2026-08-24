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

function functionScope(source, name, nextName) {
  const startToken = `function ${name}`;
  const endToken = `function ${nextName}`;
  const start = source.indexOf(startToken);
  if (start < 0) return "";
  const end = source.indexOf(endToken, start + startToken.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const listWindowsScope = functionScope(facade, "listWindows", "closeWindow");

const requiredFacadeScope = [
  ["public listWindows function", "function listWindows({app} = {})"],
  ["provider resolution retained", "resolveApplicationProvider(app)"],
  ["desktop application resolution retained", "resolveDesktopApplication(provider)"],
  ["desktop.listWindows routing", "desktop.listWindows(desktopResolved.application)"],
  ["windows array validation", "Array.isArray(observed.windows)"],
  ["observed state", "state:\"OBSERVED\""],
];

const requiredFacadeGlobal = [
  ["public listWindows export", "listWindows,"],
];

const forbiddenFacadeScope = [
  ["direct agentCtrl.listWindows in listWindows facade", "agentCtrl.listWindows()"],
  ["direct window-list command in listWindows facade", "window-list --json"],
  ["direct snapshotApplication backend detail in listWindows facade", "snapshotApplication("],
  ["direct agentCtrl backend reference in listWindows facade", "agentCtrl."],
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

const scopeFound = Boolean(listWindowsScope);
console.log(`required isolated listWindows facade scope: ${scopeFound ? "PASS" : "FAIL"}`);
if (!scopeFound) failed = true;

checkRequired(listWindowsScope, requiredFacadeScope);
checkRequired(facade, requiredFacadeGlobal);
checkForbidden(listWindowsScope, forbiddenFacadeScope);
checkRequired(macos, requiredPlugin);

console.log(`window-list-facade-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
