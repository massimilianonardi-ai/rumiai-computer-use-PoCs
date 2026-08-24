"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const ROOT = __dirname;
const PLUGIN_PATH = path.join(ROOT, "computer-control", "desktop", "plugins", "macos.js");
const FACADE_PATH = path.join(ROOT, "computer-control", "index.js");

const plugin = fs.readFileSync(PLUGIN_PATH, "utf8");
const facade = fs.readFileSync(FACADE_PATH, "utf8");

function functionScope(source, name, nextName) {
  const startToken = `function ${name}`;
  const endToken = `function ${nextName}`;
  const start = source.indexOf(startToken);
  if (start < 0) return "";
  const end = source.indexOf(endToken, start + startToken.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function report(label, ok) {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

function syntaxOk(file) {
  const checked = spawnSync(process.execPath, ["--check", file], {encoding:"utf8"});
  if (checked.status !== 0) {
    const detail = String(checked.stderr || checked.stdout || "").trim();
    if (detail) console.log(`syntax-detail=${detail}`);
  }
  return checked.status === 0;
}

const closeScope = functionScope(plugin, "closeWindow", "minimizeWindow");
const facadeCloseScope = functionScope(facade, "closeWindow", "ensureReady");

const checks = [
  ["required plugin syntax", syntaxOk(PLUGIN_PATH)],
  ["required isolated closeWindow plugin scope", Boolean(closeScope)],
  ["required native focused-window observation", closeScope.includes("macosNative.focusedWindowObservation()")],
  ["required resolved application context", closeScope.includes("listWindows(application)")],
  ["required focused target ownership check", closeScope.includes("WINDOW_TARGET_MISMATCH")],
  ["required raw pre-action window list", (closeScope.match(/agentCtrl\.listWindows\(\)/g) || []).length >= 2],
  ["required descriptor count before action", closeScope.includes("descriptorCountBefore")],
  ["required Cmd+W action retained", closeScope.includes('agentCtrl.pressKeys("Cmd+W")')],
  ["required state-driven stable wait", closeScope.includes("agentCtrl.waitStable(3000, 100)")],
  ["required descriptor count after action", closeScope.includes("descriptorCountAfter")],
  ["required exact count-decrease postcondition", closeScope.includes("descriptorCountAfter === descriptorCountBefore - 1")],
  ["required descriptor-count verification marker", closeScope.includes('verification:"window-descriptor-count-decreased"')],
  ["required verified CLOSED success", closeScope.includes('state:"CLOSED"') && closeScope.includes("verified:true")],
  ["forbidden post-close snapshot re-identification", !closeScope.includes("snapshotApplication(")],
  ["forbidden current-window id precondition", !closeScope.includes("getCurrentWindow()") && !closeScope.includes("WINDOW_ID_UNAVAILABLE")],
  ["forbidden beforeId/afterId identity comparison", !closeScope.includes("beforeId") && !closeScope.includes("afterId")],
  ["forbidden historical id-change verifier", !closeScope.includes("ax-window-absent-or-changed")],
  ["required public closeWindow facade retained", Boolean(facadeCloseScope)],
  ["required facade desktop.closeWindow routing retained", facadeCloseScope.includes("desktop.closeWindow(desktopResolved.application)")],
  ["required facade verification propagation retained", facadeCloseScope.includes("verificationMethod:result.verification")],
  ["required window.close capability retained", plugin.includes('"window.close":"IMPLEMENTED"')],
];

let failed = false;
for (const [label, ok] of checks) {
  if (!report(label, ok)) failed = true;
}

console.log(`safe-close-window-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
