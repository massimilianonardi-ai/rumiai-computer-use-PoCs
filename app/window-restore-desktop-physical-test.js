"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");
const macosWindowMinimized = require("./computer-control/backends/macos-window-minimized");

const FIXTURE = "/tmp/rumiai-v72-desktop-restore.txt";
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
  return spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
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
    fs.writeFileSync(FIXTURE, "RumiAI v72 Desktop Plugin restore fixture\n", "utf8");
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
    console.log(`window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`window-count=${Array.isArray(listed.windows) ? listed.windows.length : 0}`);
    console.log(`windows=${JSON.stringify(listed.windows || [])}`);
    if (!listed.ok) {
      failed = true;
      return;
    }

    target = (listed.windows || []).find(window => window?.title === TITLE) || null;
    console.log(`fixture-title=${TITLE}`);
    console.log(`target-window=${JSON.stringify(target)}`);
    console.log(`restore-fixture-ready=${target ? "PASS" : "FAIL"}`);
    if (!target) {
      failed = true;
      return;
    }

    const desktop = loadDesktopPlugin("darwin");
    const provider = ComputerControl.resolveApplicationProvider
      ? ComputerControl.resolveApplicationProvider("TextEdit")
      : null;

    const providerForDesktop = provider || {
      id:"textedit",
      name:"TextEdit",
      kind:"application",
      identity:{process:"TextEdit", bundle:"com.apple.TextEdit"},
      activation:{application:"TextEdit"},
    };
    const resolved = desktop.resolveApplication({
      provider:providerForDesktop,
      exactPath:"/System/Applications/TextEdit.app",
    });
    console.log(`desktop-application-resolved=${resolved.ok ? "PASS" : "FAIL"}`);
    if (!resolved.ok) {
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

    const minimized = desktop.minimizeWindow(resolved, target);
    console.log(`precondition-minimize=${minimized.ok ? "PASS" : "FAIL"}`);
    console.log(`precondition-minimize-state=${minimized.state || ""}`);
    console.log(`precondition-minimize-verified=${minimized.verified === true}`);
    console.log(`precondition-minimize-verification=${minimized.verification || ""}`);
    if (
      !minimized.ok ||
      minimized.state !== "MINIMIZED" ||
      minimized.verified !== true ||
      minimized.minimized !== true
    ) {
      console.log(`precondition-minimize-error=${minimized.error || minimized.detail || "unknown"}`);
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

    const restored = desktop.restoreWindow(resolved, target);
    console.log(`desktop-restore=${restored.ok ? "PASS" : "FAIL"}`);
    console.log(`desktop-restore-state=${restored.state || ""}`);
    console.log(`desktop-restore-error=${restored.error || ""}`);
    console.log(`desktop-restore-method=${restored.method || ""}`);
    console.log(`desktop-restore-verified=${restored.verified === true}`);
    console.log(`desktop-restore-verification=${restored.verification || ""}`);
    console.log(`desktop-restore-observed-handle=${restored.observedHandle || ""}`);
    console.log(`desktop-restore-action-handle=${restored.actionHandle || ""}`);
    console.log(`desktop-restore-handle-rebound=${restored.handleRebound === true}`);
    console.log(`desktop-restore-minimized=${restored.minimized}`);
    console.log(`desktop-restore-restored=${restored.restored === true}`);

    const nativeRestored = macosWindowMinimized.waitForWindowMinimized(target, false);
    console.log(`native-restored-state=${nativeRestored.ok ? "PASS" : "FAIL"}`);
    console.log(`native-restored-observed=${nativeRestored.minimized}`);

    const independentRestored = systemEventsMinimized(TITLE);
    console.log(`independent-restored-state=${independentRestored.ok && independentRestored.minimized === false ? "PASS" : "FAIL"}`);
    console.log(`independent-restored-observed=${independentRestored.minimized}`);

    const physicalPass = Boolean(
      restored.ok &&
      restored.state === "RESTORED" &&
      restored.verified === true &&
      restored.verification === "native-ax-minimized-false" &&
      restored.minimized === false &&
      restored.restored === true &&
      nativeRestored.ok &&
      nativeRestored.minimized === false &&
      independentRestored.ok &&
      independentRestored.minimized === false
    );
    console.log(`physical-window-restore-desktop=${physicalPass ? "PASS" : "FAIL"}`);
    if (!physicalPass) failed = true;
  } finally {
    if (target) {
      try {
        const cleanupRestore = macosWindowMinimized.setWindowMinimized(target, false);
        console.log(`fixture-restored-state=${cleanupRestore.ok ? "PASS" : "WARN"}`);
      } catch (_) {
        console.log("fixture-restored-state=WARN");
      }
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
  console.error("physical-window-restore-desktop=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
