"use strict";
const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const root = __dirname;
const helperPath = path.resolve(root, "..", "tools", "macos-window-bounds.swift");
const backendPath = path.join(root, "computer-control", "backends", "macos-window-bounds.js");
const pluginPath = path.join(root, "computer-control", "desktop", "plugins", "macos.js");
const facadePath = path.join(root, "computer-control", "index.js");
const helper = fs.readFileSync(helperPath, "utf8"); const backend = fs.readFileSync(backendPath, "utf8"); const plugin = fs.readFileSync(pluginPath, "utf8"); const facade = fs.readFileSync(facadePath, "utf8");
let failed = false; function check(l, o) { console.log(`${l}: ${o ? "PASS" : "FAIL"}`); if (!o) failed = true; }
check("required Swift helper compile", spawnSync("/usr/bin/xcrun", ["swiftc", helperPath, "-o", "/tmp/rumiai-v77-geometry-boundary"]).status === 0);
check("required backend syntax", spawnSync(process.execPath, ["--check", backendPath]).status === 0);
check("required explicit bounds set mode", helper.includes('mode == "set"') && helper.includes("setBounds(window, target)"));
check("required AX position mutation", helper.includes("kAXPositionAttribute") && helper.includes(".cgPoint"));
check("required AX size mutation", helper.includes("kAXSizeAttribute") && helper.includes(".cgSize"));
check("required backend explicit set", backend.includes("function setWindowBounds"));
check("required normalized bounds", backend.includes("function normalizeBounds"));
check("required tolerant comparison", backend.includes("function boundsEqual") && backend.includes("DEFAULT_TOLERANCE = 3"));
check("required state-driven wait", backend.includes("function waitForWindowBounds") && backend.includes("observeWindowBounds(descriptor)"));
check("forbidden shortcut", !helper.includes("CGEvent") && !backend.includes("pressKeys"));
check("forbidden AppleScript", !helper.includes("osascript") && !backend.includes("osascript"));
check("required production move deferred", plugin.includes('"window.move":"DEFERRED"'));
check("required production resize deferred", plugin.includes('"window.resize":"DEFERRED"'));
check("forbidden public move facade", !facade.includes("function moveWindow("));
check("forbidden public resize facade", !facade.includes("function resizeWindow("));
try { fs.unlinkSync("/tmp/rumiai-v77-geometry-boundary"); } catch (_) {}
console.log(`native-window-geometry-boundary=${failed ? "FAIL" : "PASS"}`); process.exit(failed ? 1 : 0);
