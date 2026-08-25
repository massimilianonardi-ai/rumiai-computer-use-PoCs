"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "tools", "macos-window-bounds.swift");
const pluginPath = path.join(root, "app", "computer-control", "desktop", "plugins", "macos.js");
const facadePath = path.join(root, "app", "computer-control", "index.js");
const helper = fs.readFileSync(helperPath, "utf8");
const plugin = fs.readFileSync(pluginPath, "utf8");
const facade = fs.readFileSync(facadePath, "utf8");

let failed = false;

function check(label, condition) {
  const ok = Boolean(condition);
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed = true;
}

const compiled = spawnSync(
  "/usr/bin/xcrun",
  ["swiftc", helperPath, "-o", "/tmp/rumiai-v74-macos-window-bounds-boundary"],
  {encoding:"utf8"}
);

check("required Swift helper compile", compiled.status === 0);
if (compiled.status !== 0) {
  console.log(`swift-compile-detail=${String(compiled.stderr || compiled.stdout || "").trim()}`);
}
check("required AX application resolution", helper.includes("AXUIElementCreateApplication(parsedPid)"));
check("required AX windows enumeration", helper.includes("kAXWindowsAttribute"));
check("required exact title matching", helper.includes("kAXTitleAttribute") && helper.includes("== expectedTitle"));
check("required missing target failure", helper.includes("WINDOW_NOT_FOUND"));
check("required ambiguous target failure", helper.includes("WINDOW_AMBIGUOUS"));
check("required AX position observation", helper.includes("kAXPositionAttribute") && helper.includes(".cgPoint"));
check("required AX size observation", helper.includes("kAXSizeAttribute") && helper.includes(".cgSize"));
check("required bounds settable checks", helper.includes("AXUIElementIsAttributeSettable") && helper.includes("WINDOW_BOUNDS_NOT_SETTABLE"));
check("required native bounds mutation", helper.includes("AXUIElementSetAttributeValue") && helper.includes("setBounds(window, target)"));
check("required visible screen frame", helper.includes("NSScreen.screens") && helper.includes("visibleFrame"));
check("required AX coordinate conversion", helper.includes("primaryTop - visible.maxY"));
check("required observe maximize set modes", helper.includes('["observe", "maximize", "set"]'));
check("forbidden keyboard shortcut", !helper.includes("Cmd+") && !helper.includes("CGEvent"));
check("forbidden AppleScript", !helper.includes("osascript") && !helper.includes("System Events"));
check("forbidden full-screen mutation", !helper.includes("AXFullScreen") && !helper.includes("kAXFullScreen"));
check("required production maximize capability deferred", /"window\.maximize"\s*:\s*"DEFERRED"/.test(plugin));
check("required production maximizeWindow unsupported", /function\s+maximizeWindow\s*\(\)\s*\{\s*return\s+unsupported\(platform,\s*"maximizeWindow"\);\s*\}/s.test(plugin));
check("forbidden premature public maximizeWindow facade", !facade.includes("function maximizeWindow("));

try { fs.unlinkSync("/tmp/rumiai-v74-macos-window-bounds-boundary"); } catch (_) {}

console.log(`native-window-maximize-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
