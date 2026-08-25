"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const facadePath = path.join(root, "app", "computer-control", "index.js");
const pluginPath = path.join(
  root,
  "app",
  "computer-control",
  "desktop",
  "plugins",
  "macos-v72.js"
);
const loaderPath = path.join(root, "app", "computer-control", "desktop", "index.js");

const facade = fs.readFileSync(facadePath, "utf8");
const plugin = fs.readFileSync(pluginPath, "utf8");
const loader = fs.readFileSync(loaderPath, "utf8");

function syntaxOk(file) {
  const result = spawnSync(process.execPath, ["--check", file], {encoding:"utf8"});
  return result.status === 0;
}

function functionScope(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const restoreScope = functionScope(
  facade,
  "function restoreWindow({app, window} = {})",
  "function closeWindow({app} = {})"
);

const checks = [
  ["required facade syntax", syntaxOk(facadePath)],
  ["required effective plugin syntax", syntaxOk(pluginPath)],
  ["required loader syntax", syntaxOk(loaderPath)],
  ["required isolated restoreWindow facade scope", restoreScope.length > 0],
  ["required application requirement", restoreScope.includes("restoreWindow requires an application")],
  ["required observed id preservation", restoreScope.includes('id:String(window?.id || "").trim()')],
  ["required observed title preservation", restoreScope.includes("title:window?.title == null ? null : String(window.title)")],
  ["required observed process preservation", restoreScope.includes('process:String(window?.process || "").trim()')],
  ["required observed pid preservation", restoreScope.includes("pid:Number(window?.pid || 0)")],
  ["required observed handle requirement", restoreScope.includes("WINDOW_HANDLE_REQUIRED")],
  ["required provider resolution", restoreScope.includes("resolveApplicationProvider(app)")],
  ["required desktop application resolution", restoreScope.includes("resolveDesktopApplication(provider)")],
  ["required desktop restore routing", restoreScope.includes("desktop.restoreWindow(")],
  ["required full descriptor routing", restoreScope.includes("desktopResolved.application,\n    targetWindow")],
  ["required verified success guard", restoreScope.includes("result.verified !== true")],
  ["required restored success guard", restoreScope.includes("result.restored !== true")],
  ["required minimized false success guard", restoreScope.includes("result.minimized !== false")],
  ["required verified failure propagation", restoreScope.includes("verified:false")],
  ["required restored failure propagation", restoreScope.includes("restored:false")],
  ["required restored success state", restoreScope.includes('state:"RESTORED"')],
  ["required minimized false success", restoreScope.includes("minimized:false")],
  ["required restored true success", restoreScope.includes("restored:true")],
  ["required verified true success", restoreScope.includes("verified:true")],
  ["required native verification propagation", restoreScope.includes("native-ax-minimized-false")],
  ["required observed handle diagnostics", restoreScope.includes("observedHandle:")],
  ["required action handle diagnostics", restoreScope.includes("actionHandle:")],
  ["required handle rebound diagnostics", restoreScope.includes("handleRebound:")],
  ["forbidden direct agentCtrl backend reference", !restoreScope.includes("agentCtrl")],
  ["forbidden direct agent-ctrl backend command", !restoreScope.includes("agent-ctrl")],
  ["forbidden native minimized backend reference", !restoreScope.includes("macosWindowMinimized")],
  ["forbidden Swift helper reference", !restoreScope.includes("rumiai-macos-window-minimized")],
  ["forbidden keyboard shortcut", !restoreScope.includes("Cmd+") && !restoreScope.includes("pressKeys")],
  ["forbidden AppleScript", !restoreScope.includes("AppleScript") && !restoreScope.includes("osascript")],
  ["forbidden coordinate targeting", !restoreScope.includes("bounds") && !restoreScope.includes("coordinate")],
  ["forbidden id-only descriptor weakening", !restoreScope.includes("{id:targetWindow.id}")],
  ["required public restoreWindow function", facade.includes("function restoreWindow({app, window} = {})")],
  ["required public restoreWindow export", facade.includes("\n  restoreWindow,\n")],
  ["required validated window.restore capability", plugin.includes('"window.restore":"IMPLEMENTED"')],
  ["required validated plugin restoreWindow", plugin.includes("function restoreWindow(application = {}, window = {})")],
  ["required validated native verification marker", plugin.includes('verification:"native-ax-minimized-false"')],
  ["required darwin loader selects validated plugin", loader.includes('darwin:"./plugins/macos-v72"')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

console.log(`verified-window-restore-facade-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
