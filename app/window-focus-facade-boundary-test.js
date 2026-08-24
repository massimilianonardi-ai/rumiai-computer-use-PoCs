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

function functionScope(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const focusScope = functionScope(
  facade,
  "function focusWindow({app, window} = {})",
  "function closeWindow({app} = {})"
);

const requiredScope = [
  ["isolated focusWindow facade scope", focusScope.length > 0],
  ["application requirement", focusScope.includes("focusWindow requires an application")],
  ["stable window id extraction", focusScope.includes("const targetId = String(window?.id || \"\").trim()")],
  ["stable window id requirement", focusScope.includes("WINDOW_ID_REQUIRED")],
  ["provider resolution retained", focusScope.includes("resolveApplicationProvider(app)")],
  ["desktop application resolution retained", focusScope.includes("resolveDesktopApplication(provider)")],
  ["desktop.focusWindow routing", focusScope.includes("desktop.focusWindow(")],
  ["id-only desktop target", focusScope.includes("{id:targetId}")],
  ["verified failure propagation", focusScope.includes("verified:false")],
  ["verified success propagation", focusScope.includes("verified:result.verified === true")],
  ["focused state", focusScope.includes("state:\"FOCUSED\"")],
];

const forbiddenScope = [
  ["direct agentCtrl backend reference", !focusScope.includes("agentCtrl")],
  ["direct agent-ctrl backend command", !focusScope.includes("agent-ctrl")],
  ["direct snapshotApplication backend detail", !focusScope.includes("snapshotApplication")],
  ["title-based action targeting", !focusScope.includes("window?.title")],
  ["coordinate-based action targeting", !focusScope.includes("bounds") && !focusScope.includes("coordinate")],
];

const requiredFacade = [
  ["public focusWindow function", facade.includes("function focusWindow({app, window} = {})")],
  ["public focusWindow export", facade.includes("\n  focusWindow,\n")],
];

const requiredPlugin = [
  ["validated window.focus capability retained", macos.includes("\"window.focus\":\"IMPLEMENTED\"")],
  ["validated macOS focusWindow retained", macos.includes("function focusWindow(application = {}, window = {})")],
  ["target pinned postcondition retained", macos.includes("targetAfter.pinned === true")],
  ["focus verification marker retained", macos.includes("window-list-target-pinned")],
];

let failed = false;

function report(prefix, checks) {
  for (const [label, ok] of checks) {
    console.log(`${prefix} ${label}: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) failed = true;
  }
}

report("required", requiredScope);
report("forbidden", forbiddenScope);
report("required", requiredFacade);
report("required", requiredPlugin);

console.log(`window-focus-facade-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
