"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const ROOT = __dirname;
const backendPath = path.join(ROOT, "computer-control", "backends", "macos-window-minimized.js");
const basePluginPath = path.join(ROOT, "computer-control", "desktop", "plugins", "macos.js");
const pluginPath = path.join(ROOT, "computer-control", "desktop", "plugins", "macos-v70.js");
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

const minimizeScope = functionScope(
  plugin,
  "function minimizeWindow(application = {}, window = {})",
  "module.exports ="
);

check("required backend syntax", syntaxOk(backendPath));
check("required effective plugin syntax", syntaxOk(pluginPath));
check("required loader syntax", syntaxOk(loaderPath));
check("required validated base plugin syntax", syntaxOk(basePluginPath));

check(
  "required v69 Swift helper backend integration",
  backend.includes("macos-window-minimized.swift") &&
  backend.includes("rumiai-macos-window-minimized")
);
check(
  "required backend observe primitive",
  backend.includes("function observeWindowMinimized(descriptor = {})")
);
check(
  "required backend mutation primitive",
  backend.includes("function setWindowMinimized(descriptor = {}, minimized = true)") &&
  backend.includes('mode:minimized ? "minimize" : "restore"')
);
check(
  "required backend state-driven verification",
  backend.includes("function waitForWindowMinimized(descriptor = {}, expected = true, opts = {})") &&
  backend.includes("while ((performance.now() - started) <= timeoutMs)") &&
  backend.includes("observeWindowMinimized(descriptor)")
);
check(
  "required native minimized true marker",
  backend.includes('"native-ax-minimized-true"')
);
check(
  "forbidden backend Cmd+M shortcut",
  !backend.includes("Cmd+M") && !backend.includes("pressKeys")
);
check(
  "forbidden backend AppleScript",
  !backend.includes("osascript") && !backend.includes("System Events")
);

check(
  "required validated base plugin preserved",
  basePlugin.includes('"window.minimize":"DEFERRED"') &&
  basePlugin.includes('return unsupported(platform, "minimizeWindow")')
);
check(
  "required effective plugin composition",
  plugin.includes('const base = require("./macos")') &&
  plugin.includes("...base,")
);
check(
  "required effective window.minimize capability",
  plugin.includes('"window.minimize":"IMPLEMENTED"')
);
check(
  "required isolated minimizeWindow scope",
  minimizeScope.length > 0
);
check(
  "required full observed descriptor",
  normalizeScope.includes('id:String(window?.id || "").trim()') &&
  normalizeScope.includes("title:window?.title") &&
  normalizeScope.includes('process:String(window?.process || "").trim()') &&
  normalizeScope.includes("pid:Number(window?.pid || 0)") &&
  minimizeScope.includes("const observedTarget = normalizeWindow(window)")
);
check(
  "required application context through validated base",
  minimizeScope.includes("base.listWindows(application)")
);
check(
  "required fresh raw pre-action window list",
  minimizeScope.includes("agentCtrl.listWindows()")
);
check(
  "required descriptor re-resolution",
  minimizeScope.includes("sameDescriptor(observedTarget, item)")
);
check(
  "required stale target failure",
  minimizeScope.includes('error:"WINDOW_TARGET_STALE"')
);
check(
  "required ambiguous target failure",
  minimizeScope.includes('error:"WINDOW_TARGET_AMBIGUOUS"')
);
check(
  "required current handle rebound diagnostics",
  minimizeScope.includes("currentTarget.id !== observedTarget.id") &&
  minimizeScope.includes("observedHandle:observedTarget.id") &&
  minimizeScope.includes("actionHandle:currentTarget.id")
);
check(
  "required native AXMinimized mutation",
  minimizeScope.includes("macosWindowMinimized.setWindowMinimized") &&
  minimizeScope.includes("currentTarget,\n    true")
);
check(
  "required state-driven minimized postcondition",
  minimizeScope.includes("macosWindowMinimized.waitForWindowMinimized") &&
  minimizeScope.includes('verification:"native-ax-minimized-true"')
);
check(
  "required verified MINIMIZED success",
  minimizeScope.includes('state:"MINIMIZED"') &&
  minimizeScope.includes("minimized:true") &&
  minimizeScope.includes("verified:true")
);
check(
  "forbidden minimize action through stale observed handle",
  !minimizeScope.includes("setWindowMinimized(observedTarget") &&
  !minimizeScope.includes("focusWindow(observedTarget.id")
);
check(
  "forbidden plugin Cmd+M shortcut",
  !minimizeScope.includes("Cmd+M") && !minimizeScope.includes("pressKeys")
);
check(
  "forbidden plugin AppleScript",
  !minimizeScope.includes("osascript") && !minimizeScope.includes("System Events")
);
check(
  "required darwin loader selects effective plugin",
  loader.includes('darwin:"./plugins/macos-v70"')
);
check(
  "forbidden premature public minimizeWindow facade",
  !facade.includes("function minimizeWindow(") &&
  !/\bminimizeWindow\s*,\s*(?:\n|\r|})/.test(facade)
);

console.log(`verified-window-minimize-desktop-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
