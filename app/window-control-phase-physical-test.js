"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const boundsBackend = require("./computer-control/backends/macos-window-bounds");
const minimizedBackend = require("./computer-control/backends/macos-window-minimized");

const FIXTURE_A = "/tmp/rumiai-v82-window-control-A.txt";
const FIXTURE_B = "/tmp/rumiai-v82-window-control-B.txt";
const TITLE_A = path.basename(FIXTURE_A);
const TITLE_B = path.basename(FIXTURE_B);

function openFixture(file) {
  return spawnSync("/usr/bin/open", ["-a", "TextEdit", file], {encoding:"utf8"}).status === 0;
}

function closeFixture(title) {
  const script = `
    tell application "TextEdit"
      repeat with d in documents
        if name of d is "${title}" then close d saving no
      end repeat
    end tell
  `;
  return spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
}

function independentBounds(title) {
  const script = `
    tell application "System Events"
      tell process "TextEdit"
        set matches to every window whose name is "${title}"
        if (count of matches) is not 1 then return "AMBIGUOUS"
        set p to position of item 1 of matches
        set s to size of item 1 of matches
        return (item 1 of p as text) & "," & (item 2 of p as text) & "," & ¬
          (item 1 of s as text) & "," & (item 2 of s as text)
      end tell
    end tell
  `;
  const result = spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
  const values = String(result.stdout || "").trim().split(",").map(Number);
  return result.status === 0 && values.length === 4 && values.every(Number.isFinite)
    ? {x:values[0], y:values[1], width:values[2], height:values[3]}
    : null;
}

function independentMinimized(title) {
  const script = `
    tell application "System Events"
      tell process "TextEdit"
        set matches to every window whose name is "${title}"
        if (count of matches) is not 1 then return "AMBIGUOUS"
        return value of attribute "AXMinimized" of item 1 of matches
      end tell
    end tell
  `;
  const result = spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
  const raw = String(result.stdout || "").trim().toLowerCase();
  return result.status === 0 && (raw === "true" || raw === "false")
    ? raw === "true"
    : null;
}

function completeDescriptor(window, title) {
  return Boolean(window?.id && window?.title === title && window?.process && Number(window?.pid || 0) > 0);
}

async function main() {
  let failed = false;
  let targetA = null;
  let originalA = null;

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE_A, "RumiAI v82 Window Control fixture A\n");
    fs.writeFileSync(FIXTURE_B, "RumiAI v82 Window Control fixture B\n");
    const openedA = openFixture(FIXTURE_A);
    const openedB = openFixture(FIXTURE_B);
    console.log(`fixture-A-open=${openedA ? "PASS" : "FAIL"}`);
    console.log(`fixture-B-open=${openedB ? "PASS" : "FAIL"}`);
    if (!openedA || !openedB) { failed = true; return; }

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) {
      console.log(`application-ready-error=${ready.error || ready.detail || ""}`);
      failed = true;
      return;
    }

    const listed = ComputerControl.listWindows({app:"TextEdit"});
    targetA = (listed.windows || []).find(window => window.title === TITLE_A) || null;
    const targetB = (listed.windows || []).find(window => window.title === TITLE_B) || null;
    const descriptorsPass = completeDescriptor(targetA, TITLE_A) && completeDescriptor(targetB, TITLE_B) && targetA.id !== targetB.id;
    console.log(`public-window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`public-window-count=${(listed.windows || []).length}`);
    console.log(`fixture-A-descriptor=${JSON.stringify(targetA)}`);
    console.log(`fixture-B-descriptor=${JSON.stringify(targetB)}`);
    console.log(`complete-distinct-descriptors=${descriptorsPass ? "PASS" : "FAIL"}`);
    if (!listed.ok || !descriptorsPass) { failed = true; return; }

    const focused = ComputerControl.focusWindow({app:"TextEdit", window:targetA});
    console.log(`public-window-focus=${focused.ok && focused.verified === true ? "PASS" : "FAIL"}`);
    console.log(`public-window-focus-verification=${focused.verificationMethod || ""}`);
    if (!focused.ok || focused.verified !== true) { failed = true; return; }

    const current = ComputerControl.getCurrentWindow({app:"TextEdit"});
    const currentValue = current.window?.value || current.window || null;
    const currentPass = current.ok && currentValue?.title === TITLE_A;
    console.log(`public-current-window=${currentPass ? "PASS" : "FAIL"}`);
    console.log(`public-current-title=${currentValue?.title || ""}`);
    if (!currentPass) { failed = true; return; }

    const originalObserved = boundsBackend.observeWindowBounds(targetA);
    originalA = originalObserved.bounds;
    console.log(`native-original-bounds=${JSON.stringify(originalA)}`);
    if (!originalObserved.ok || !originalA) { failed = true; return; }

    const prepared = {x:190, y:145, width:620, height:420};
    const preparedAction = boundsBackend.setWindowBounds(targetA, prepared);
    const preparedPass = preparedAction.ok && boundsBackend.waitForWindowBounds(targetA, prepared).ok;
    console.log(`fixture-A-prepared=${preparedPass ? "PASS" : "FAIL"}`);
    if (!preparedPass) { failed = true; return; }

    const movedPosition = {x:325, y:250};
    const moved = ComputerControl.moveWindow({app:"TextEdit", window:targetA, position:movedPosition});
    const movedExpected = {...prepared, ...movedPosition};
    const movedIndependent = independentBounds(TITLE_A);
    const movedPass = Boolean(
      moved.ok && moved.state === "MOVED" && moved.moved === true && moved.verified === true &&
      moved.verificationMethod === "native-ax-window-position" &&
      boundsBackend.boundsEqual(movedIndependent, movedExpected)
    );
    console.log(`public-window-move=${movedPass ? "PASS" : "FAIL"}`);
    console.log(`public-window-move-bounds=${JSON.stringify(moved.bounds || null)}`);
    console.log(`independent-move-bounds=${JSON.stringify(movedIndependent)}`);
    if (!movedPass) { failed = true; return; }

    const resizedSize = {width:790, height:545};
    const resized = ComputerControl.resizeWindow({app:"TextEdit", window:targetA, size:resizedSize});
    const resizedExpected = {...movedExpected, ...resizedSize};
    const resizedIndependent = independentBounds(TITLE_A);
    const resizedPass = Boolean(
      resized.ok && resized.state === "RESIZED" && resized.resized === true && resized.verified === true &&
      resized.verificationMethod === "native-ax-window-size" &&
      boundsBackend.boundsEqual(resizedIndependent, resizedExpected)
    );
    console.log(`public-window-resize=${resizedPass ? "PASS" : "FAIL"}`);
    console.log(`public-window-resize-bounds=${JSON.stringify(resized.bounds || null)}`);
    console.log(`independent-resize-bounds=${JSON.stringify(resizedIndependent)}`);
    if (!resizedPass) { failed = true; return; }

    const maximized = ComputerControl.maximizeWindow({app:"TextEdit", window:targetA});
    const maximizedIndependent = independentBounds(TITLE_A);
    const maximizedPass = Boolean(
      maximized.ok && maximized.state === "MAXIMIZED" && maximized.maximized === true && maximized.verified === true &&
      maximized.verificationMethod === "native-ax-visible-frame-bounds" &&
      boundsBackend.boundsEqual(maximizedIndependent, maximized.desiredBounds)
    );
    console.log(`public-window-maximize=${maximizedPass ? "PASS" : "FAIL"}`);
    console.log(`public-window-maximize-bounds=${JSON.stringify(maximized.bounds || null)}`);
    console.log(`independent-maximize-bounds=${JSON.stringify(maximizedIndependent)}`);
    if (!maximizedPass) { failed = true; return; }

    const interCapabilityRestore = boundsBackend.setWindowBounds(targetA, prepared);
    const interCapabilityRestored = interCapabilityRestore.ok && boundsBackend.waitForWindowBounds(targetA, prepared).ok;
    console.log(`inter-capability-bounds-restore=${interCapabilityRestored ? "PASS" : "FAIL"}`);
    if (!interCapabilityRestored) { failed = true; return; }

    const minimized = ComputerControl.minimizeWindow({app:"TextEdit", window:targetA});
    const nativeMinimized = minimizedBackend.waitForWindowMinimized(targetA, true);
    const independentMinimizedState = independentMinimized(TITLE_A);
    const minimizedPass = Boolean(
      minimized.ok && minimized.state === "MINIMIZED" && minimized.minimized === true && minimized.verified === true &&
      minimized.verificationMethod === "native-ax-minimized-true" && nativeMinimized.ok && independentMinimizedState === true
    );
    console.log(`public-window-minimize=${minimizedPass ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized=${independentMinimizedState}`);
    if (!minimizedPass) { failed = true; return; }

    const restored = ComputerControl.restoreWindow({app:"TextEdit", window:targetA});
    const nativeRestored = minimizedBackend.waitForWindowMinimized(targetA, false);
    const independentRestoredState = independentMinimized(TITLE_A);
    const restoredPass = Boolean(
      restored.ok && restored.state === "RESTORED" && restored.restored === true && restored.minimized === false && restored.verified === true &&
      restored.verificationMethod === "native-ax-minimized-false" && nativeRestored.ok && independentRestoredState === false
    );
    console.log(`public-window-restore=${restoredPass ? "PASS" : "FAIL"}`);
    console.log(`independent-restored-minimized=${independentRestoredState}`);
    if (!restoredPass) { failed = true; return; }

    const refocused = ComputerControl.focusWindow({app:"TextEdit", window:targetA});
    console.log(`public-window-refocus-before-close=${refocused.ok && refocused.verified === true ? "PASS" : "FAIL"}`);
    if (!refocused.ok || refocused.verified !== true) { failed = true; return; }

    const closed = ComputerControl.closeWindow({app:"TextEdit"});
    console.log(`public-window-close=${closed.ok && closed.verified === true ? "PASS" : "FAIL"}`);
    console.log(`public-window-close-state=${closed.state || ""}`);
    console.log(`public-window-close-verification=${closed.verificationMethod || ""}`);
    if (!closed.ok || closed.state !== "CLOSED" || closed.verified !== true) { failed = true; return; }

    const afterClose = ComputerControl.listWindows({app:"TextEdit"});
    const aAbsent = !(afterClose.windows || []).some(window => window.title === TITLE_A);
    const bPresent = (afterClose.windows || []).some(window => window.title === TITLE_B);
    console.log(`closed-fixture-A-absent=${aAbsent ? "PASS" : "FAIL"}`);
    console.log(`surviving-fixture-B-present=${bPresent ? "PASS" : "FAIL"}`);
    if (!afterClose.ok || !aAbsent || !bPresent) { failed = true; return; }

    console.log("physical-macos-window-control-phase=PASS");
  } finally {
    if (targetA && originalA) {
      try { minimizedBackend.setWindowMinimized(targetA, false); } catch (_) {}
      try { boundsBackend.setWindowBounds(targetA, originalA); } catch (_) {}
    }
    const cleanupA = closeFixture(TITLE_A);
    const cleanupB = closeFixture(TITLE_B);
    console.log(`fixture-A-cleanup=${cleanupA.status === 0 ? "PASS" : "WARN"}`);
    console.log(`fixture-B-cleanup=${cleanupB.status === 0 ? "PASS" : "WARN"}`);
    if (cleanupA.status !== 0) console.log(`fixture-A-cleanup-detail=${String(cleanupA.stderr || cleanupA.stdout || "").trim()}`);
    if (cleanupB.status !== 0) console.log(`fixture-B-cleanup-detail=${String(cleanupB.stderr || cleanupB.stdout || "").trim()}`);
    try { fs.unlinkSync(FIXTURE_A); } catch (_) {}
    try { fs.unlinkSync(FIXTURE_B); } catch (_) {}
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-macos-window-control-phase=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(TITLE_A); } catch (_) {}
  try { closeFixture(TITLE_B); } catch (_) {}
  try { ComputerControl.shutdownRuntime(); } catch (_) {}
  process.exit(1);
});
