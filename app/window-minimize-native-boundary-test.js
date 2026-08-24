"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "tools", "macos-window-minimized.swift");
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
  ["swiftc", helperPath, "-o", "/tmp/rumiai-v69-macos-window-minimized-boundary"],
  {encoding:"utf8"}
);

check("required Swift helper compile", compiled.status === 0);
if (compiled.status !== 0) {
  console.log(`swift-compile-detail=${String(compiled.stderr || compiled.stdout || "").trim()}`);
}

check(
  "required AX application resolution",
  helper.includes("AXUIElementCreateApplication(parsedPid)")
);
check(
  "required AX windows enumeration",
  helper.includes("kAXWindowsAttribute") &&
  helper.includes("AXUIElementCopyAttributeValue")
);
check(
  "required exact title matching",
  helper.includes("kAXTitleAttribute") &&
  helper.includes("== expectedTitle")
);
check(
  "required missing target failure",
  helper.includes("WINDOW_NOT_FOUND")
);
check(
  "required ambiguous target failure",
  helper.includes("WINDOW_AMBIGUOUS") &&
  helper.includes("matches.count != 1")
);
check(
  "required minimized attribute observation",
  helper.includes("kAXMinimizedAttribute") &&
  helper.includes("minimizedBefore") &&
  helper.includes("minimizedAfter")
);
check(
  "required minimized attribute settable check",
  helper.includes("AXUIElementIsAttributeSettable") &&
  helper.includes("MINIMIZED_ATTRIBUTE_NOT_SETTABLE")
);
check(
  "required minimized attribute mutation",
  helper.includes("AXUIElementSetAttributeValue") &&
  helper.includes("kCFBooleanTrue") &&
  helper.includes("kCFBooleanFalse")
);
check(
  "required observe minimize restore modes",
  helper.includes("[\"observe\", \"minimize\", \"restore\"]")
);
check(
  "forbidden Cmd+M helper implementation",
  !helper.includes("Cmd+M") && !helper.includes("command down")
);
check(
  "forbidden AppleScript helper implementation",
  !helper.includes("osascript") && !helper.includes("tell application")
);
check(
  "required production minimize capability still deferred",
  /"window\.minimize"\s*:\s*"DEFERRED"/.test(plugin)
);
check(
  "required production minimizeWindow still unsupported",
  /function\s+minimizeWindow\s*\(\)\s*\{\s*return\s+unsupported\(platform,\s*"minimizeWindow"\);\s*\}/s.test(plugin)
);
check(
  "forbidden premature public minimizeWindow facade",
  !/function\s+minimizeWindow\s*\(\{/.test(facade)
);

try { fs.unlinkSync("/tmp/rumiai-v69-macos-window-minimized-boundary"); } catch (_) {}

console.log(`native-window-minimize-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
