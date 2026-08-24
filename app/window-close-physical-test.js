"use strict";

const fs = require("fs");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

const FIXTURE_PATH = "/tmp/rumiai-v59-window-close-physical.txt";

function windowId(window) {
  if (!window) return null;
  const value = window?.value || window;
  return value?.id || window?.id || null;
}

function snapshotWindowId(snapshot) {
  const match = String(snapshot || "").match(/^# window:\s+(.+?)\s+-/m);
  return match ? match[1].trim() : null;
}

async function main() {
  const desktop = loadDesktopPlugin();
  let failed = false;

  console.log(`desktop=${desktop.id} platform=${desktop.platform}`);

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);

  if (!runtime.ok) {
    console.log(`runtime-error=${runtime.error || runtime.detail || "unknown"}`);
    process.exit(1);
  }

  try {
    // Test-only fixture: explicitly open a temporary TextEdit document so this
    // physical test does not depend on TextEdit already owning a window.
    fs.writeFileSync(
      FIXTURE_PATH,
      "RumiAI v59 verified window-close physical fixture\n",
      "utf8"
    );

    const opened = spawnSync(
      "/usr/bin/open",
      ["-a", "TextEdit", FIXTURE_PATH],
      {encoding:"utf8"}
    );
    console.log(`window-fixture-open=${opened.status === 0 ? "PASS" : "FAIL"}`);

    if (opened.status !== 0) {
      console.log(`window-fixture-error=${String(opened.stderr || opened.stdout || "open failed").trim()}`);
      failed = true;
      return;
    }

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);

    if (!ready.ok) {
      console.log(`application-error=${ready.error || ready.detail || "unknown"}`);
      failed = true;
      return;
    }

    const before = ComputerControl.getCurrentWindow({app:"TextEdit"});
    console.log(`before-window-observation=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`before-window=${JSON.stringify(before.window || null)}`);

    if (!before.ok || !before.window) {
      console.log(`before-window-error=${before.error || before.detail || "current window unavailable"}`);
      failed = true;
      return;
    }

    const beforeId = windowId(before.window);
    console.log(`before-window-id=${beforeId || ""}`);

    if (!beforeId) {
      console.log("before-window-id-error=window id unavailable");
      failed = true;
      return;
    }

    const closed = ComputerControl.closeWindow({app:"TextEdit"});
    console.log(`window-close=${closed.ok ? "PASS" : "FAIL"}`);
    console.log(`window-close-state=${closed.state || ""}`);
    console.log(`window-close-method=${closed.method || ""}`);
    console.log(`window-close-verified=${closed.verified === true ? "true" : "false"}`);
    console.log(`window-close-verification=${closed.verificationMethod || ""}`);
    console.log(`closed-window=${JSON.stringify(closed.window || null)}`);
    console.log(`plugin-current-window=${JSON.stringify(closed.currentWindow || null)}`);

    if (!closed.ok || closed.verified !== true) {
      console.log(`window-close-error=${closed.error || closed.detail || "window close not verified"}`);
      failed = true;
      return;
    }

    // Keep the known-stale observer visible for diagnostics, but do not use it
    // as the independent postcondition.
    const staleWindow = ComputerControl.getCurrentWindow({app:"TextEdit"});
    console.log(`diagnostic-current-window=${JSON.stringify(staleWindow.window || null)}`);

    // Independent verification uses a fresh AX snapshot. No snapshot means the
    // app owns no observable window; otherwise the current AX window id must be
    // different from the pre-close id.
    const afterSnapshot = ComputerControl.snapshot({
      app:"TextEdit",
      settle:true,
      compact:true,
    });
    const afterId = afterSnapshot.ok
      ? snapshotWindowId(afterSnapshot.snapshot)
      : null;

    console.log(`after-snapshot=${afterSnapshot.ok ? "OBSERVED" : "ABSENT"}`);
    console.log(`after-snapshot-window-id=${afterId || ""}`);

    const independentlyVerified =
      !afterSnapshot.ok ||
      (afterId !== null && afterId !== beforeId);

    console.log(`independent-close-verification=${independentlyVerified ? "PASS" : "FAIL"}`);

    if (!independentlyVerified) {
      failed = true;
      return;
    }

    console.log("physical-window-close=PASS");
  } finally {
    try {
      fs.unlinkSync(FIXTURE_PATH);
    } catch (_) {
      // Test fixture cleanup is best-effort.
    }

    const runtimeClosed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${runtimeClosed.ok ? "PASS" : "FAIL"}`);
    if (!runtimeClosed.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-window-close=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try {
    fs.unlinkSync(FIXTURE_PATH);
  } catch (_) {}
  try {
    const runtimeClosed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${runtimeClosed.ok ? "PASS" : "FAIL"}`);
  } catch (_) {
    // Best-effort cleanup after an unexpected test harness failure.
  }
  process.exit(1);
});
