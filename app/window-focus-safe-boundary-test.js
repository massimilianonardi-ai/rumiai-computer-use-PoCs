"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const BACKEND = path.join(ROOT, "computer-control", "backends", "macos-native.js");
const PLUGIN = path.join(ROOT, "computer-control", "desktop", "plugins", "macos.js");
const FACADE = path.join(ROOT, "computer-control", "index.js");

const backend = fs.readFileSync(BACKEND, "utf8");
const plugin = fs.readFileSync(PLUGIN, "utf8");
const facade = fs.readFileSync(FACADE, "utf8");

let failed = false;

function check(label, condition) {
  const pass = Boolean(condition);
  console.log(`${label}: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) failed = true;
}

function syntaxValid(source) {
  try {
    new Function(source);
    return true;
  } catch (_) {
    return false;
  }
}

function isolateFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  return end >= 0 ? source.slice(start, end) : source.slice(start);
}

const pluginFocus = isolateFunction(plugin, "focusWindow", "windowId");
const facadeFocus = isolateFunction(facade, "focusWindow", "closeWindow");

check("required backend syntax", syntaxValid(backend));
check("required plugin syntax", syntaxValid(plugin));
check("required facade syntax", syntaxValid(facade));

check(
  "required native focused-window helper integration",
  backend.includes("function ensureFocusedWindowHelper()") &&
  backend.includes("macos-focused-window.swift") &&
  backend.includes("rumiai-macos-focused-window")
);
check(
  "required native focused-window observation",
  backend.includes("function focusedWindowObservation()") &&
  backend.includes('state:"OBSERVED"')
);
check(
  "required state-driven native focused-window wait",
  backend.includes("function waitForFocusedWindow(expected = {}, opts = {})") &&
  backend.includes("focusedWindowMatches(expected, last)") &&
  backend.includes("sleepSync(pollMs)")
);
check(
  "required native focus verification marker",
  backend.includes('verification:"native-focused-window-descriptor"')
);

check("required isolated plugin focusWindow scope", Boolean(pluginFocus));
check(
  "required descriptor normalization",
  pluginFocus.includes("normalizeFocusDescriptor(window)") &&
  pluginFocus.includes("observedTarget.title") &&
  pluginFocus.includes("observedTarget.process") &&
  pluginFocus.includes("observedTarget.pid")
);
check(
  "required insufficient descriptor failure",
  pluginFocus.includes('error:"WINDOW_DESCRIPTOR_INSUFFICIENT"')
);
check(
  "required fresh raw pre-action window list",
  pluginFocus.includes("const fresh = agentCtrl.listWindows()")
);
check(
  "required descriptor re-resolution",
  pluginFocus.includes("const matches = currentWindows.filter") &&
  pluginFocus.includes("sameFocusDescriptor(observedTarget, item)")
);
check(
  "required stale descriptor failure",
  pluginFocus.includes('error:"WINDOW_TARGET_STALE"')
);
check(
  "required ambiguous descriptor failure",
  pluginFocus.includes('error:"WINDOW_TARGET_AMBIGUOUS"') &&
  pluginFocus.includes("matches.length !== 1")
);
check(
  "required current action handle",
  pluginFocus.includes("const currentTarget = matches[0]") &&
  pluginFocus.includes("agentCtrl.focusWindow(currentTarget.id)")
);
check(
  "required rebound diagnostics",
  pluginFocus.includes("const handleRebound = currentTarget.id !== observedTarget.id") &&
  pluginFocus.includes("observedHandle:observedTarget.id") &&
  pluginFocus.includes("actionHandle:currentTarget.id")
);
check(
  "required native postcondition",
  pluginFocus.includes("macosNative.waitForFocusedWindow({") &&
  pluginFocus.includes('verification:"native-focused-window-descriptor"')
);
check(
  "forbidden old pinned-id postcondition",
  !pluginFocus.includes("window-list-target-pinned") &&
  !pluginFocus.includes("targetAfter") &&
  !pluginFocus.includes("targetAfter.pinned")
);
check(
  "forbidden action through observed handle",
  !pluginFocus.includes("agentCtrl.focusWindow(observedTarget.id)")
);

check("required isolated facade focusWindow scope", Boolean(facadeFocus));
check(
  "required facade full observed descriptor",
  facadeFocus.includes("const targetWindow = {") &&
  facadeFocus.includes("title:window?.title") &&
  facadeFocus.includes("process:String(window?.process") &&
  facadeFocus.includes("pid:Number(window?.pid")
);
check(
  "required descriptor routing to desktop plugin",
  facadeFocus.includes("desktop.focusWindow(") &&
  facadeFocus.includes("targetWindow")
);
check(
  "forbidden old id-only facade routing",
  !facadeFocus.includes("{id:targetId}") &&
  !facadeFocus.includes("id-first")
);
check(
  "required facade rebound diagnostics",
  facadeFocus.includes("observedHandle:") &&
  facadeFocus.includes("actionHandle:") &&
  facadeFocus.includes("handleRebound:") &&
  facadeFocus.includes("nativeWindow:")
);
check(
  "required facade native verification default",
  facadeFocus.includes('native-focused-window-descriptor')
);
check(
  "required window.focus capability retained",
  plugin.includes('"window.focus":"IMPLEMENTED"')
);

console.log(`safe-window-focus-boundary=${failed ? "FAIL" : "PASS"}`);
process.exitCode = failed ? 1 : 0;
