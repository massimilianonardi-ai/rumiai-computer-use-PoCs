"use strict";
const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");
const boundsBackend = require("./computer-control/backends/macos-window-bounds");
const FIXTURE = "/tmp/rumiai-v75-desktop-maximize.txt";
const TITLE = path.basename(FIXTURE);

function openFixture() { const r = spawnSync("/usr/bin/open", ["-a", "TextEdit", FIXTURE], {encoding:"utf8"}); return r.status === 0; }
function closeFixture() { return spawnSync("/usr/bin/osascript", ["-e", `tell application "TextEdit" to repeat with d in documents\nif name of d is "${TITLE}" then close d saving no\nend repeat`], {encoding:"utf8"}); }
function independentBounds() {
  const script = `tell application "System Events" to tell process "TextEdit"\nset m to every window whose name is "${TITLE}"\nif (count of m) is not 1 then return "AMBIGUOUS"\nset p to position of item 1 of m\nset s to size of item 1 of m\nreturn (item 1 of p as text) & "," & (item 2 of p as text) & "," & (item 1 of s as text) & "," & (item 2 of s as text)\nend tell`;
  const r = spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
  const v = String(r.stdout || "").trim().split(",").map(Number);
  return r.status === 0 && v.length === 4 && v.every(Number.isFinite) ? {x:v[0], y:v[1], width:v[2], height:v[3]} : null;
}

async function main() {
  let failed = false;
  let target = null;
  let original = null;
  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);
  try {
    fs.writeFileSync(FIXTURE, "RumiAI v75 Desktop Plugin maximize fixture\n");
    console.log(`fixture-open=${openFixture() ? "PASS" : "FAIL"}`);
    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) { failed = true; return; }
    const listed = ComputerControl.listWindows({app:"TextEdit"});
    target = (listed.windows || []).find(w => w.title === TITLE) || null;
    console.log(`window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`target-window=${JSON.stringify(target)}`);
    if (!target) { failed = true; return; }
    const desktop = loadDesktopPlugin("darwin");
    const provider = ComputerControl.resolveApplicationProvider("TextEdit");
    const resolved = desktop.resolveApplication({provider, exactPath:"/System/Applications/TextEdit.app"});
    console.log(`desktop-application-resolved=${resolved.ok ? "PASS" : "FAIL"}`);
    if (!resolved.ok) { failed = true; return; }
    const before = boundsBackend.observeWindowBounds(target);
    original = before.bounds;
    console.log(`native-before=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`native-original-bounds=${JSON.stringify(original)}`);
    if (!before.ok || !original) { failed = true; return; }
    const prepared = {x:original.x + 40, y:original.y + 40, width:Math.max(420, Math.min(700, Math.round(original.width * .72))), height:Math.max(320, Math.min(500, Math.round(original.height * .72)))};
    const prep = boundsBackend.setWindowBounds(target, prepared);
    const prepVerified = prep.ok ? boundsBackend.waitForWindowBounds(target, prepared) : {ok:false};
    console.log(`fixture-prepared=${prepVerified.ok ? "PASS" : "FAIL"}`);
    if (!prepVerified.ok) { failed = true; return; }
    const result = desktop.maximizeWindow(resolved, target);
    console.log(`desktop-maximize=${result.ok ? "PASS" : "FAIL"}`);
    console.log(`desktop-maximize-state=${result.state || ""}`);
    console.log(`desktop-maximize-error=${result.error || ""}`);
    console.log(`desktop-maximize-verified=${result.verified === true}`);
    console.log(`desktop-maximize-verification=${result.verification || ""}`);
    console.log(`desktop-maximize-observed-handle=${result.observedHandle || ""}`);
    console.log(`desktop-maximize-action-handle=${result.actionHandle || ""}`);
    console.log(`desktop-maximize-handle-rebound=${result.handleRebound === true}`);
    console.log(`desktop-maximize-bounds=${JSON.stringify(result.bounds || null)}`);
    console.log(`desktop-maximize-desired=${JSON.stringify(result.desiredBounds || null)}`);
    const native = result.desiredBounds ? boundsBackend.waitForWindowBounds(target, result.desiredBounds) : {ok:false};
    const independent = independentBounds();
    const independentOk = boundsBackend.boundsEqual(independent, result.desiredBounds);
    console.log(`native-maximized-state=${native.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-maximized-state=${independentOk ? "PASS" : "FAIL"}`);
    console.log(`independent-maximized-bounds=${JSON.stringify(independent)}`);
    const pass = result.ok && result.state === "MAXIMIZED" && result.maximized === true && result.verified === true && result.verification === "native-ax-visible-frame-bounds" && native.ok && independentOk;
    console.log(`physical-window-maximize-desktop=${pass ? "PASS" : "FAIL"}`);
    if (!pass) failed = true;
    const restore = boundsBackend.setWindowBounds(target, original);
    const restored = restore.ok ? boundsBackend.waitForWindowBounds(target, original) : {ok:false};
    console.log(`fixture-restored-state=${restored.ok ? "PASS" : "FAIL"}`);
    if (!restored.ok) failed = true;
  } finally {
    if (target && original) try { boundsBackend.setWindowBounds(target, original); } catch (_) {}
    console.log(`fixture-cleanup=${closeFixture().status === 0 ? "PASS" : "WARN"}`);
    try { fs.unlinkSync(FIXTURE); } catch (_) {}
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}
main().catch(error => { console.error("physical-window-maximize-desktop=FAIL"); console.error(error.stack || String(error)); try { closeFixture(); } catch (_) {} try { ComputerControl.shutdownRuntime(); } catch (_) {} process.exit(1); });
