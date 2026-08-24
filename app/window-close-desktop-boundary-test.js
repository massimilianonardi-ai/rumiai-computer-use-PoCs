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
  ["public closeWindow function", "function closeWindow({app} = {})"],
  ["desktop.closeWindow routing", "desktop.closeWindow(desktopResolved.application)"],
  ["public closeWindow export", "closeWindow,"],
  ["provider resolution retained", "resolveApplicationProvider(app)"],
  ["desktop application resolution retained", "resolveDesktopApplication(provider)"],
];

const forbiddenFacade = [
  ["direct Cmd+W in facade", "pressKeys(\"Cmd+W\")"],
  ["direct agent-ctrl close implementation in facade", "agentCtrl.pressKeys(\"Cmd+W\")"],
];

const requiredPlugin = [
  ["window.close capability implemented", "\"window.close\":\"IMPLEMENTED\""],
  ["macOS closeWindow implementation", "function closeWindow(application = {})"],
  ["macOS Cmd+W implementation", "agentCtrl.pressKeys(\"Cmd+W\")"],
  ["pre-close window observation", "const before = agentCtrl.getCurrentWindow()"],
  ["post-close window observation", "const after = agentCtrl.getCurrentWindow()"],
  ["verified close failure", "WINDOW_CLOSE_UNVERIFIED"],
  ["verified close postcondition", "current-window-changed-or-absent"],
];

const forbiddenPlugin = [
  ["closeWindow still deferred", "unsupported(platform, \"closeWindow\")"],
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
checkForbidden(macos, forbiddenPlugin);

console.log(`window-close-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
