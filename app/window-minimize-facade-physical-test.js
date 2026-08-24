"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const macosWindowMinimized = require("./computer-control/backends/macos-window-minimized");

const FIXTURE = "/tmp/rumiai-v71-facade-minimize.txt";
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

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE, "RumiAI v71 public facade minimize fixture\n", "utf8");

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

    const target = listed.windows.find(window => window?.title === TITLE) || null;
    console.log(`fixture-title=${TITLE}`);
    console.log(`target-window=${JSON.stringify(target)}`);

    const fullDescriptor = Boolean(
      target?.id &&
      target?.title === TITLE &&
      target?.process &&
      Number(target?.pid || 0) > 0
    );
    console.log(`minimize-fixture-ready=${fullDescriptor ? "PASS" : "FAIL"}`);
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

    const result = ComputerControl.minimizeWindow({
      app:"TextEdit",
      window:target,
    });

    console.log(`facade-window-minimize=${result.ok ? "PASS" : "FAIL"}`);
    console.log(`facade-window-minimize-state=${result.state || ""}`);
    console.log(`facade-window-minimize-error=${result.error || ""}`);
    console.log(`facade-window-minimize-method=${result.method || ""}`);
    console.log(`facade-window-minimize-verified=${result.verified === true}`);
    console.log(`facade-window-minimize-verification=${result.verificationMethod || ""}`);
    console.log(`facade-window-minimize-observed-handle=${result.observedHandle || ""}`);
    console.log(`facade-window-minimize-action-handle=${result.actionHandle || ""}`);
    console.log(`facade-window-minimize-handle-rebound=${result.handleRebound === true}`);
    console.log(`facade-window-minimize-minimized=${result.minimized === true}`);
    console.log(`facade-minimized-window=${JSON.stringify(result.window || null)}`);

    const nativeAfter = macosWindowMinimized.waitForWindowMinimized(target, true);
    console.log(`native-minimized-state=${nativeAfter.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-observed=${nativeAfter.minimized}`);

    const independent = systemEventsMinimized(TITLE);
    console.log(`independent-minimized-state=${independent.ok && independent.minimized === true ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized-observed=${independent.minimized}`);

    const physicalPass = Boolean(
      result.ok &&
      result.state === "MINIMIZED" &&
      result.minimized === true &&
      result.verified === true &&
      result.verificationMethod === "native-ax-minimized-true" &&
      result.observedHandle === target.id &&
      nativeAfter.ok &&
      nativeAfter.minimized === true &&
      independent.ok &&
      independent.minimized === true
    );

    console.log(`facade-minimize-postcondition=${physicalPass ? "PASS" : "FAIL"}`);
    console.log(`physical-window-minimize-facade=${physicalPass ? "PASS" : "FAIL"}`);
    if (!physicalPass) failed = true;

    const restored = macosWindowMinimized.setWindowMinimized(target, false);
    console.log(`fixture-restore-action=${restored.ok ? "PASS" : "FAIL"}`);
    const restoreVerified = restored.ok
      ? macosWindowMinimized.waitForWindowMinimized(target, false)
      : {ok:false, minimized:null};
    console.log(`fixture-restored-state=${restoreVerified.ok && restoreVerified.minimized === false ? "PASS" : "FAIL"}`);
    if (!restored.ok || !restoreVerified.ok || restoreVerified.minimized !== false) {
      failed = true;
    }
  } finally {
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
  console.error("physical-window-minimize-facade=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
