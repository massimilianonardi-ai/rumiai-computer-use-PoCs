"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const agentCtrl = require("./computer-control/backends/agent-ctrl");

const FIXTURE_A = "/tmp/rumiai-v64-window-handle-A.txt";
const FIXTURE_B = "/tmp/rumiai-v64-window-handle-B.txt";
const TITLE_A = path.basename(FIXTURE_A);
const TITLE_B = path.basename(FIXTURE_B);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function frontDocumentName() {
  const script = `
    tell application "TextEdit"
      if (count of documents) is 0 then return ""
      return name of front document
    end tell
  `;

  const result = spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );

  return {
    ok:result.status === 0,
    name:String(result.stdout || "").trim(),
    detail:String(result.stderr || "").trim(),
  };
}

async function waitForFrontDocument(expected, timeoutMs = 3000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;

  while ((performance.now() - started) < timeoutMs) {
    last = frontDocumentName();
    attempts += 1;

    if (last.ok && last.name === expected) {
      return {
        ok:true,
        name:last.name,
        attempts,
        elapsedMs:performance.now() - started,
      };
    }

    await sleep(100);
  }

  return {
    ok:false,
    name:last?.name || "",
    detail:last?.detail || "",
    attempts,
    elapsedMs:performance.now() - started,
  };
}

function closeFixtureDocuments() {
  const script = `
    tell application "TextEdit"
      repeat with d in documents
        if (name of d is "${TITLE_A}") or (name of d is "${TITLE_B}") then
          close d saving no
        end if
      end repeat
    end tell
  `;

  return spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );
}

function normalizeWindow(window) {
  return {
    id:String(window?.id || ""),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || ""),
    pid:Number(window?.pid || 0),
    focused:window?.focused === true,
    pinned:window?.pinned === true,
  };
}

async function main() {
  let failed = false;

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE_A, "RumiAI v64 handle fixture A\n", "utf8");
    fs.writeFileSync(FIXTURE_B, "RumiAI v64 handle fixture B\n", "utf8");

    const openedA = openFixture(FIXTURE_A);
    const openedB = openFixture(FIXTURE_B);
    console.log(`fixture-A-open=${openedA.ok ? "PASS" : "FAIL"}`);
    console.log(`fixture-B-open=${openedB.ok ? "PASS" : "FAIL"}`);

    if (!openedA.ok || !openedB.ok) {
      console.log(`fixture-open-error=${openedA.detail || openedB.detail || "unknown"}`);
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

    const before = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`before-window-list=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`before-window-count=${Array.isArray(before.windows) ? before.windows.length : 0}`);
    console.log(`before-windows=${JSON.stringify(before.windows || [])}`);

    if (!before.ok || !Array.isArray(before.windows)) {
      console.log(`before-window-list-error=${before.error || before.detail || "unavailable"}`);
      failed = true;
      return;
    }

    const fixtures = before.windows.filter(window =>
      window && (window.title === TITLE_A || window.title === TITLE_B)
    );
    const pinned = fixtures.find(window => window.pinned === true) || null;
    const target = fixtures.find(window => window.pinned !== true) || null;

    const fixtureReady = Boolean(
      fixtures.length >= 2 &&
      pinned?.id &&
      target?.id &&
      pinned.id !== target.id
    );

    console.log(`fixture-window-count=${fixtures.length}`);
    console.log(`initial-pinned-title=${pinned?.title || ""}`);
    console.log(`initial-pinned-id=${pinned?.id || ""}`);
    console.log(`target-title=${target?.title || ""}`);
    console.log(`target-id=${target?.id || ""}`);
    console.log(`handle-fixture-ready=${fixtureReady ? "PASS" : "FAIL"}`);

    if (!fixtureReady) {
      failed = true;
      return;
    }

    const observedHandle = {
      id:target.id,
      title:target.title,
      process:target.process,
      pid:target.pid,
    };
    console.log(`observed-handle=${JSON.stringify(observedHandle)}`);

    const focused = ComputerControl.focusWindow({
      app:"TextEdit",
      window:{id:observedHandle.id},
    });

    console.log(`focus-action=${focused.ok ? "PASS" : "FAIL"}`);
    console.log(`focus-action-state=${focused.state || ""}`);
    console.log(`focus-action-verified=${focused.verified === true}`);
    console.log(`focus-action-window=${JSON.stringify(focused.window || null)}`);

    if (!focused.ok) {
      console.log(`focus-action-error=${focused.error || focused.detail || "unknown"}`);
      failed = true;
      return;
    }

    await sleep(150);

    // Intentionally read the session's raw window list here. Do not call the
    // public/plugin listWindows(application) path after focus because that path
    // performs a target-process snapshot and can change the session pin/order.
    const afterRaw = agentCtrl.listWindows();
    const afterWindows = Array.isArray(afterRaw.windows)
      ? afterRaw.windows.map(normalizeWindow)
      : [];

    console.log(`after-raw-window-list=${afterRaw.ok ? "PASS" : "FAIL"}`);
    console.log(`after-raw-windows=${JSON.stringify(afterWindows)}`);

    if (!afterRaw.ok) {
      console.log(`after-raw-window-list-error=${afterRaw.stderr || afterRaw.stdout || "unavailable"}`);
      failed = true;
      return;
    }

    const sameIdAfter = afterWindows.find(window => window.id === observedHandle.id) || null;
    const sameTitleAfter = afterWindows.find(window => window.title === observedHandle.title) || null;

    const sameIdStillSameWindow = Boolean(
      sameIdAfter &&
      sameIdAfter.title === observedHandle.title &&
      sameIdAfter.process === observedHandle.process &&
      sameIdAfter.pid === observedHandle.pid
    );

    const sameWindowStillSameId = Boolean(
      sameTitleAfter &&
      sameTitleAfter.id === observedHandle.id &&
      sameTitleAfter.process === observedHandle.process &&
      sameTitleAfter.pid === observedHandle.pid
    );

    const stability = sameIdStillSameWindow && sameWindowStillSameId
      ? "STABLE"
      : "REBOUND";

    console.log(`old-id-now-title=${sameIdAfter?.title || "ABSENT"}`);
    console.log(`target-title-now-id=${sameTitleAfter?.id || "ABSENT"}`);
    console.log(`same-id-still-same-window=${sameIdStillSameWindow ? "true" : "false"}`);
    console.log(`same-window-still-same-id=${sameWindowStillSameId ? "true" : "false"}`);
    console.log(`window-handle-stability=${stability}`);

    const independent = await waitForFrontDocument(observedHandle.title);
    console.log(`independent-front-document=${independent.name || ""}`);
    console.log(`independent-focus-attempts=${independent.attempts}`);
    console.log(`independent-focus-verification=${independent.ok ? "PASS" : "FAIL"}`);

    if (!independent.ok) {
      console.log(`independent-focus-error=${independent.detail || "front document mismatch"}`);
      failed = true;
      return;
    }

    console.log("diagnostic-complete=PASS");
  } finally {
    const cleanup = closeFixtureDocuments();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);

    for (const file of [FIXTURE_A, FIXTURE_B]) {
      try {
        fs.unlinkSync(file);
      } catch (_) {}
    }

    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("diagnostic-complete=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixtureDocuments(); } catch (_) {}
  for (const file of [FIXTURE_A, FIXTURE_B]) {
    try { fs.unlinkSync(file); } catch (_) {}
  }
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
