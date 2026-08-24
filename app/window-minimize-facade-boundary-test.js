"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const facadePath = path.join(root, "app", "computer-control", "index.js");
const pluginPath = path.join(
  root,
  "app",
  "computer-control",
  "desktop",
  "plugins",
  "macos-v70.js"
);
const loaderPath = path.join(root, "app", "computer-control", "desktop", "index.js");

const facade = fs.readFileSync(facadePath, "utf8");
const plugin = fs.readFileSync(pluginPath, "utf8");
const loader = fs.readFileSync(loaderPath, "utf8");

function syntaxOk(file) {
  try {
    require("child_process").execFileSync(
      process.execPath,
      ["--check", file],
      {stdio:"pipe"}
    );
    return true;
  } catch (_) {
    return false;
  }
}

function functionScope(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const minimizeScope = functionScope(
  facade,
  "function minimizeWindow({app, window} = {})",
  "function closeWindow({app} = {})"
);

const checks = [
  ["required facade syntax", syntaxOk(facadePath)],
  ["required effective plugin syntax", syntaxOk(pluginPath)],
  ["required loader syntax", syntaxOk(loaderPath)],
  ["required isolated minimizeWindow facade scope", minimizeScope.length > 0],
  ["required application requirement", minimizeScope.includes("minimizeWindow requires an application")],
  ["required observed id preservation", minimizeScope.includes('id:String(window?.id || "").trim()')],
  ["required observed title preservation", minimizeScope.includes("title:window?.title == null ? null : String(window.title)")],
  ["required observed process preservation", minimizeScope.includes('process:String(window?.process || "").trim()')],
  ["required observed pid preservation", minimizeScope.includes("pid:Number(window?.pid || 0)")],
  ["required observed handle requirement", minimizeScope.includes("WINDOW_HANDLE_REQUIRED")],
  ["required provider resolution", minimizeScope.includes("resolveApplicationProvider(app)")],
  ["required desktop application resolution", minimizeScope.includes("resolveDesktopApplication(provider)")],
  ["required desktop minimize routing", minimizeScope.includes("desktop.minimizeWindow(")],
  ["required full descriptor routing", minimizeScope.includes("desktopResolved.application,\n    targetWindow")],
  ["required verified success guard", minimizeScope.includes("result.verified !== true || result.minimized !== true")],
  ["required verified failure propagation", minimizeScope.includes("verified:false")],
  ["required minimized success state", minimizeScope.includes('state:"MINIMIZED"')],
  ["required minimized true success", minimizeScope.includes("minimized:true")],
  ["required verified true success", minimizeScope.includes("verified:true")],
  ["required native verification propagation", minimizeScope.includes("native-ax-minimized-true")],
  ["required observed handle diagnostics", minimizeScope.includes("observedHandle:")],
  ["required action handle diagnostics", minimizeScope.includes("actionHandle:")],
  ["required handle rebound diagnostics", minimizeScope.includes("handleRebound:")],
  ["forbidden direct agentCtrl backend reference", !minimizeScope.includes("agentCtrl")],
  ["forbidden direct agent-ctrl backend command", !minimizeScope.includes("agent-ctrl")],
  ["forbidden native minimized backend reference", !minimizeScope.includes("macosWindowMinimized")],
  ["forbidden Swift helper reference", !minimizeScope.includes("rumiai-macos-window-minimized")],
  ["forbidden Cmd+M shortcut", !minimizeScope.includes("Cmd+M")],
  ["forbidden AppleScript", !minimizeScope.includes("AppleScript") && !minimizeScope.includes("osascript")],
  ["forbidden coordinate targeting", !minimizeScope.includes("bounds") && !minimizeScope.includes("coordinate")],
  ["forbidden id-only descriptor weakening", !minimizeScope.includes("{id:targetWindow.id}")],
  ["required public minimizeWindow function", facade.includes("function minimizeWindow({app, window} = {})")],
  ["required public minimizeWindow export", facade.includes("\n  minimizeWindow,\n")],
  ["required validated window.minimize capability", plugin.includes('"window.minimize":"IMPLEMENTED"')],
  ["required validated plugin minimizeWindow", plugin.includes("function minimizeWindow(application = {}, window = {})")],
  ["required validated native verification marker", plugin.includes('verification:"native-ax-minimized-true"')],
  ["required darwin loader selects validated plugin", loader.includes('darwin:"./plugins/macos-v70"')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

console.log(`verified-window-minimize-facade-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
