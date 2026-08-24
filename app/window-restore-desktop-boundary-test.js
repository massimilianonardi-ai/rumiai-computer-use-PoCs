"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const ROOT = __dirname;
const backendPath = path.join(ROOT, "computer-control", "backends", "macos-window-minimized.js");
const basePluginPath = path.join(ROOT, "computer-control", "desktop", "plugins", "macos-v70.js");
const pluginPath = path.join(ROOT, "computer-control", "desktop", "plugins", "macos-v72.js");
const loaderPath = path.join(ROOT, "computer-control", "desktop", "index.js");
const facadePath = path.join(ROOT, "computer-control", "index.js");

const backend = fs.readFileSync(backendPath, "utf8");
const basePlugin = fs.readFileSync(basePluginPath, "utf8");
const plugin = fs.readFileSync(pluginPath, "utf8");
const loader = fs.readFileSync(loaderPath, "utf8");
const facade = fs.readFileSync(facadePath, "utf8");

let failed = false;

function check(label, ok) {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

function syntaxOk(file) {
  const result = spawnSync(process.execPath, ["--check", file], {encoding:"utf8"});
  return result.status === 0;
}

function functionScope(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) return source.slice(start);
  return source.slice(start, end);
}

const normalizeScope = functionScope(
  plugin,
  "function normalizeWindow(window = {})",
  "function descriptorComplete"
);

const restoreScope = functionScope(
  plugin,
  "function restoreWindow(application = {}, window = {})",
  "module.exports ="
);

check("required backend syntax", syntaxOk(backendPath));
check("required validated v70 plugin syntax", syntaxOk(basePluginPath));
check("required effective v72 plugin syntax", syntaxOk(pluginPath));
check("required loader syntax", syntaxOk(loaderPath));

check(
  "required validated v70 plugin composition",
  plugin.includes('const base = require("./macos-v70")') &&
  plugin.includes("...base,")
);
check(
  "required validated window.minimize capability preserved",
  basePlugin.includes('"window.minimize":"IMPLEMENTED"')
);
check(
  "required effective window.restore capability",
  plugin.includes('"window.restore":"IMPLEMENTED"')
);
check("required isolated restoreWindow scope", restoreScope.length > 0);
check(
  "required full observed descriptor",
  normalizeScope.includes('id:String(window?.id || "").trim()') &&
  normalizeScope.includes("title:window?.title") &&
  normalizeScope.includes('process:String(window?.process || "").trim()') &&
  normalizeScope.includes("pid:Number(window?.pid || 0)") &&
  restoreScope.includes("const observedTarget = normalizeWindow(window)")
);
check(
  "required application context through validated base",
  restoreScope.includes("base.listWindows(application)")
);
check(
  "required fresh raw pre-action window list",
  restoreScope.includes("agentCtrl.listWindows()")
);
check(
  "required descriptor re-resolution",
  restoreScope.includes("sameDescriptor(observedTarget, item)")
);
check(
  "required stale target failure",
  restoreScope.includes('error:"WINDOW_TARGET_STALE"')
);
check(
  "required ambiguous target failure",
  restoreScope.includes('error:"WINDOW_TARGET_AMBIGUOUS"')
);
check(
  "required current handle rebound diagnostics",
  restoreScope.includes("currentTarget.id !== observedTarget.id") &&
  restoreScope.includes("observedHandle:observedTarget.id") &&
  restoreScope.includes("actionHandle:currentTarget.id")
);
check(
  "required native minimized precondition",
  restoreScope.includes("macosWindowMinimized.observeWindowMinimized(currentTarget)") &&
  restoreScope.includes("before.minimizedAfter !== true") &&
  restoreScope.includes('error:"WINDOW_NOT_MINIMIZED"')
);
check(
  "required native AXMinimized false mutation",
  restoreScope.includes("macosWindowMinimized.setWindowMinimized") &&
  restoreScope.includes("currentTarget,\n    false")
);
check(
  "required state-driven restored postcondition",
  restoreScope.includes("macosWindowMinimized.waitForWindowMinimized") &&
  restoreScope.includes('verification:"native-ax-minimized-false"')
);
check(
  "required verified RESTORED success",
  restoreScope.includes('state:"RESTORED"') &&
  restoreScope.includes("minimized:false") &&
  restoreScope.includes("restored:true") &&
  restoreScope.includes("verified:true")
);
check(
  "required backend false-state verification marker",
  backend.includes('"native-ax-minimized-false"')
);
check(
  "forbidden restore action through stale observed handle",
  !restoreScope.includes("setWindowMinimized(observedTarget")
);
check(
  "forbidden plugin keyboard shortcut",
  !restoreScope.includes("Cmd+") && !restoreScope.includes("pressKeys")
);
check(
  "forbidden plugin AppleScript",
  !restoreScope.includes("osascript") && !restoreScope.includes("System Events")
);
check(
  "required darwin loader selects effective plugin",
  loader.includes('darwin:"./plugins/macos-v72"')
);
check(
  "forbidden premature public restoreWindow facade",
  !facade.includes("function restoreWindow(") &&
  !/\brestoreWindow\s*,\s*(?:\n|\r|})/.test(facade)
);

console.log(`verified-window-restore-desktop-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
