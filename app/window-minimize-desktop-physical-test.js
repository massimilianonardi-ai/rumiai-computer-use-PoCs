"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");
const macosWindowMinimized = require("./computer-control/backends/macos-window-minimized");

const FIXTURE = "/tmp/rumiai-v70-desktop-minimize.txt";
const TITLE = path.basename(FIXTURE);

function openFixture(file) {
  const r = spawnSync("/usr/bin/open", ["-a", "TextEdit", file], {encoding:"utf8"});
  return {ok:r.status === 0, detail:String(r.stderr || r.stdout || "").trim()};
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
        set matches to every window whose name is "${TITLE}"
        if (count of matches) is not 1 then return "AMBIGUOUS"
        return value of attribute "AXMinimized" of item 1 of matches
      end tell
    end tell
  `;
  const r = spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
  const raw = String(r.stdout || "").trim().toLowerCase();
  return {
    ok:r.status === 0 && (raw === "true" || raw === "false"),
    minimized:raw === "true" ? true : raw === "false" ? false : null,
    detail:String(r.stderr || r.stdout || "").trim(),
  };
}

async function main() {
  let failed = false;
  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE, "RumiAI v70 Desktop Plugin minimize fixture\n", "utf8");
    const opened = openFixture(FIXTURE);
    console.log(`fixture-open=${opened.ok ? "PASS" : "FAIL"}`);
    if (!opened.ok) { failed = true; return; }

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) { failed = true; return; }

    const listed = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`window-count=${Array.isArray(listed.windows) ? listed.windows.length : 0}`);
    console.log(`windows=${JSON.stringify(listed.windows || [])}`);
    if (!listed.ok) { failed = true; return; }

    const target = (listed.windows || []).find(w => w?.title === TITLE) || null;
    console.log(`fixture-title=${TITLE}`);
    console.log(`target-window=${JSON.stringify(target)}`);
    console.log(`minimize-fixture-ready=${target ? "PASS" : "FAIL"}`);
    if (!target) { failed = true; return; }

    const desktop = loadDesktopPlugin("darwin");
    const provider = ComputerControl.resolveApplicationProvider
      ? ComputerControl.resolveApplicationProvider("TextEdit")
      : null;

    // Resolve application through the effective Desktop Plugin using the same
    // provider metadata used by ComputerControl.
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
    if (!resolved.ok) { failed = true; return; }

    const before = macosWindowMinimized.observeWindowMinimized(target);
    console.log(`native-before=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-before=${before.minimized}`);
    if (!before.ok || before.minimized !== false) { failed = true; return; }

    const result = desktop.minimizeWindow(resolved, target);
    console.log(`desktop-minimize=${result.ok ? "PASS" : "FAIL"}`);
    console.log(`desktop-minimize-state=${result.state || ""}`);
    console.log(`desktop-minimize-error=${result.error || ""}`);
    console.log(`desktop-minimize-method=${result.method || ""}`);
    console.log(`desktop-minimize-verified=${result.verified === true}`);
    console.log(`desktop-minimize-verification=${result.verification || ""}`);
    console.log(`desktop-minimize-observed-handle=${result.observedHandle || ""}`);
    console.log(`desktop-minimize-action-handle=${result.actionHandle || ""}`);
    console.log(`desktop-minimize-handle-rebound=${result.handleRebound === true}`);
    console.log(`desktop-minimize-minimized=${result.minimized === true}`);

    const nativeAfter = macosWindowMinimized.waitForWindowMinimized(target, true);
    console.log(`native-minimized-state=${nativeAfter.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-observed=${nativeAfter.minimized}`);

    const independent = systemEventsMinimized(TITLE);
    console.log(`independent-minimized-state=${independent.ok && independent.minimized === true ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized-observed=${independent.minimized}`);

    const physicalPass = Boolean(
      result.ok &&
      result.state === "MINIMIZED" &&
      result.verified === true &&
      result.verification === "native-ax-minimized-true" &&
      result.minimized === true &&
      nativeAfter.ok && nativeAfter.minimized === true &&
      independent.ok && independent.minimized === true
    );
    console.log(`physical-window-minimize-desktop=${physicalPass ? "PASS" : "FAIL"}`);
    if (!physicalPass) failed = true;

    const restored = macosWindowMinimized.setWindowMinimized(target, false);
    console.log(`fixture-restore-action=${restored.ok ? "PASS" : "FAIL"}`);
    const restoreVerified = restored.ok
      ? macosWindowMinimized.waitForWindowMinimized(target, false)
      : {ok:false, minimized:null};
    console.log(`fixture-restored-state=${restoreVerified.ok && restoreVerified.minimized === false ? "PASS" : "FAIL"}`);
    if (!restored.ok || !restoreVerified.ok || restoreVerified.minimized !== false) failed = true;
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
  console.error("physical-window-minimize-desktop=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
