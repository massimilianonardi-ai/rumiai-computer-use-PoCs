"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const macosWindowMinimized = require("./computer-control/backends/macos-window-minimized");

const FIXTURE = "/tmp/rumiai-v73-facade-restore.txt";
const TITLE = path.basename(FIXTURE);

function openFixture(file) {
  const result = spawnSync(
    "/usr/bin/open",
    ["-a", "TextEdit", file],
    {encoding:"utf8"}
  );

  return {
    ok:result.status === 0,
    detail:String(result.stderr || result.stdout || "").trim(),
  };
}

function closeFixture() {
  const script = `
    tell application "TextEdit"
      repeat with d in documents
        if (name of d is "${TITLE}") then close d saving no
      end repeat
    end tell
  `;

  return spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );
}

function systemEventsMinimized(title) {
  const script = `
    tell application "System Events"
      tell process "TextEdit"
        set matches to every window whose name is "${title}"
        if (count of matches) is not 1 then return "AMBIGUOUS"
        return value of attribute "AXMinimized" of item 1 of matches
      end tell
    end tell
  `;

  const result = spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );
  const raw = String(result.stdout || "").trim().toLowerCase();

  return {
    ok:result.status === 0 && (raw === "true" || raw === "false"),
    minimized:raw === "true" ? true : raw === "false" ? false : null,
    detail:String(result.stderr || result.stdout || "").trim(),
  };
}

async function main() {
  let failed = false;
  let target = null;

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE, "RumiAI v73 public facade restore fixture\n", "utf8");

    const opened = openFixture(FIXTURE);
    console.log(`fixture-open=${opened.ok ? "PASS" : "FAIL"}`);
    if (!opened.ok) {
      console.log(`fixture-open-error=${opened.detail || "unknown"}`);
      failed = true;
      return;
    }

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) {
      console.log(`application-ready-error=${ready.error || ready.detail || "unknown"}`);
      failed = true;
      return;
    }

    const listed = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`facade-window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`facade-window-count=${Array.isArray(listed.windows) ? listed.windows.length : 0}`);
    console.log(`facade-windows=${JSON.stringify(listed.windows || [])}`);
    if (!listed.ok || !Array.isArray(listed.windows)) {
      console.log(`facade-window-list-error=${listed.error || listed.detail || "window list unavailable"}`);
      failed = true;
      return;
    }

    target = listed.windows.find(window => window?.title === TITLE) || null;
    console.log(`fixture-title=${TITLE}`);
    console.log(`target-window=${JSON.stringify(target)}`);

    const fullDescriptor = Boolean(
      target?.id &&
      target?.title === TITLE &&
      target?.process &&
      Number(target?.pid || 0) > 0
    );
    console.log(`restore-fixture-ready=${fullDescriptor ? "PASS" : "FAIL"}`);
    if (!fullDescriptor) {
      failed = true;
      return;
    }

    const before = macosWindowMinimized.observeWindowMinimized(target);
    console.log(`native-before=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-before=${before.minimizedAfter}`);
    if (!before.ok || before.minimizedAfter !== false) {
      failed = true;
      return;
    }

    const minimized = ComputerControl.minimizeWindow({
      app:"TextEdit",
      window:target,
    });
    console.log(`facade-precondition-minimize=${minimized.ok ? "PASS" : "FAIL"}`);
    console.log(`facade-precondition-minimize-state=${minimized.state || ""}`);
    console.log(`facade-precondition-minimize-verified=${minimized.verified === true}`);
    console.log(`facade-precondition-minimize-verification=${minimized.verificationMethod || ""}`);
    if (
      !minimized.ok ||
      minimized.state !== "MINIMIZED" ||
      minimized.minimized !== true ||
      minimized.verified !== true
    ) {
      console.log(`facade-precondition-minimize-error=${minimized.error || minimized.detail || "unknown"}`);
      failed = true;
      return;
    }

    const nativeMinimized = macosWindowMinimized.waitForWindowMinimized(target, true);
    console.log(`native-minimized-precondition=${nativeMinimized.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-observed=${nativeMinimized.minimized}`);

    const independentMinimized = systemEventsMinimized(TITLE);
    console.log(`independent-minimized-precondition=${independentMinimized.ok && independentMinimized.minimized === true ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized-observed=${independentMinimized.minimized}`);

    if (
      !nativeMinimized.ok ||
      nativeMinimized.minimized !== true ||
      !independentMinimized.ok ||
      independentMinimized.minimized !== true
    ) {
      failed = true;
      return;
    }

    const restored = ComputerControl.restoreWindow({
      app:"TextEdit",
      window:target,
    });

    console.log(`facade-window-restore=${restored.ok ? "PASS" : "FAIL"}`);
    console.log(`facade-window-restore-state=${restored.state || ""}`);
    console.log(`facade-window-restore-error=${restored.error || ""}`);
    console.log(`facade-window-restore-method=${restored.method || ""}`);
    console.log(`facade-window-restore-verified=${restored.verified === true}`);
    console.log(`facade-window-restore-verification=${restored.verificationMethod || ""}`);
    console.log(`facade-window-restore-observed-handle=${restored.observedHandle || ""}`);
    console.log(`facade-window-restore-action-handle=${restored.actionHandle || ""}`);
    console.log(`facade-window-restore-handle-rebound=${restored.handleRebound === true}`);
    console.log(`facade-window-restore-minimized=${restored.minimized}`);
    console.log(`facade-window-restore-restored=${restored.restored === true}`);
    console.log(`facade-restored-window=${JSON.stringify(restored.window || null)}`);

    const nativeRestored = macosWindowMinimized.waitForWindowMinimized(target, false);
    console.log(`native-restored-state=${nativeRestored.ok ? "PASS" : "FAIL"}`);
    console.log(`native-restored-observed=${nativeRestored.minimized}`);

    const independentRestored = systemEventsMinimized(TITLE);
    console.log(`independent-restored-state=${independentRestored.ok && independentRestored.minimized === false ? "PASS" : "FAIL"}`);
    console.log(`independent-restored-observed=${independentRestored.minimized}`);

    const physicalPass = Boolean(
      restored.ok &&
      restored.state === "RESTORED" &&
      restored.restored === true &&
      restored.minimized === false &&
      restored.verified === true &&
      restored.verificationMethod === "native-ax-minimized-false" &&
      restored.observedHandle === target.id &&
      nativeRestored.ok &&
      nativeRestored.minimized === false &&
      independentRestored.ok &&
      independentRestored.minimized === false
    );

    console.log(`facade-restore-postcondition=${physicalPass ? "PASS" : "FAIL"}`);
    console.log(`physical-window-restore-facade=${physicalPass ? "PASS" : "FAIL"}`);
    if (!physicalPass) failed = true;
  } finally {
    if (target) {
      try { macosWindowMinimized.setWindowMinimized(target, false); } catch (_) {}
    }

    const cleanup = closeFixture();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);
    try { fs.unlinkSync(FIXTURE); } catch (_) {}

    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-window-restore-facade=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
