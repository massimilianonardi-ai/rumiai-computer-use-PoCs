"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const agentCtrl = require("./computer-control/backends/agent-ctrl");

const FIXTURE_A = "/tmp/rumiai-v66-safe-focus-A.txt";
const FIXTURE_B = "/tmp/rumiai-v66-safe-focus-B.txt";
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
    fs.writeFileSync(FIXTURE_A, "RumiAI v66 safe focus fixture A\n", "utf8");
    fs.writeFileSync(FIXTURE_B, "RumiAI v66 safe focus fixture B\n", "utf8");

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

    const observedList = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`observed-window-list=${observedList.ok ? "PASS" : "FAIL"}`);
    console.log(`observed-window-count=${Array.isArray(observedList.windows) ? observedList.windows.length : 0}`);
    console.log(`observed-windows=${JSON.stringify(observedList.windows || [])}`);

    if (!observedList.ok || !Array.isArray(observedList.windows)) {
      console.log(`observed-window-list-error=${observedList.error || observedList.detail || "unavailable"}`);
      failed = true;
      return;
    }

    const fixtures = observedList.windows.filter(window =>
      window && (window.title === TITLE_A || window.title === TITLE_B)
    );
    const initialPinned = fixtures.find(window => window.pinned === true) || null;
    const target = fixtures.find(window => window.pinned !== true) || null;

    const fixtureReady = Boolean(
      fixtures.length >= 2 &&
      initialPinned?.id &&
      target?.id &&
      initialPinned.id !== target.id &&
      target.title &&
      target.process &&
      Number(target.pid) > 0
    );

    console.log(`fixture-window-count=${fixtures.length}`);
    console.log(`initial-pinned-title=${initialPinned?.title || ""}`);
    console.log(`initial-pinned-id=${initialPinned?.id || ""}`);
    console.log(`target-title=${target?.title || ""}`);
    console.log(`target-observed-handle=${target?.id || ""}`);
    console.log(`safe-focus-fixture-ready=${fixtureReady ? "PASS" : "FAIL"}`);

    if (!fixtureReady) {
      failed = true;
      return;
    }

    const observedDescriptor = {
      id:String(target.id),
      title:String(target.title),
      process:String(target.process),
      pid:Number(target.pid),
    };
    console.log(`observed-descriptor=${JSON.stringify(observedDescriptor)}`);

    const frontBefore = frontDocumentName();
    console.log(`front-document-before=${frontBefore.name || ""}`);

    // TEST-ONLY rebinding fixture. v64 proved that agent-ctrl's macOS
    // pid/index handle changes meaning when AXWindows order changes. Focus the
    // observed target through the raw backend once to deliberately trigger that
    // reorder before handing the original descriptor to the public v66 API.
    const reboundAction = agentCtrl.focusWindow(observedDescriptor.id);
    console.log(`fixture-rebind-action=${reboundAction.ok ? "PASS" : "FAIL"}`);
    console.log(`fixture-rebind-method=${reboundAction.method || ""}`);

    if (!reboundAction.ok) {
      console.log(`fixture-rebind-error=${reboundAction.stderr || reboundAction.stdout || "focus-window failed"}`);
      failed = true;
      return;
    }

    const reboundFront = await waitForFrontDocument(observedDescriptor.title);
    console.log(`fixture-rebind-front-document=${reboundFront.name || ""}`);
    console.log(`fixture-rebind-independent-focus=${reboundFront.ok ? "PASS" : "FAIL"}`);

    if (!reboundFront.ok) {
      failed = true;
      return;
    }

    const reboundRaw = agentCtrl.listWindows();
    const reboundWindows = Array.isArray(reboundRaw.windows)
      ? reboundRaw.windows.map(normalizeWindow)
      : [];

    console.log(`rebound-raw-window-list=${reboundRaw.ok ? "PASS" : "FAIL"}`);
    console.log(`rebound-raw-windows=${JSON.stringify(reboundWindows)}`);

    if (!reboundRaw.ok) {
      console.log(`rebound-raw-window-list-error=${reboundRaw.stderr || reboundRaw.stdout || "unavailable"}`);
      failed = true;
      return;
    }

    const oldHandleNow = reboundWindows.find(
      window => window.id === observedDescriptor.id
    ) || null;
    const targetNow = reboundWindows.find(window =>
      window.title === observedDescriptor.title &&
      window.process === observedDescriptor.process &&
      window.pid === observedDescriptor.pid
    ) || null;

    const reboundPrepared = Boolean(
      oldHandleNow &&
      targetNow &&
      oldHandleNow.title !== observedDescriptor.title &&
      targetNow.id &&
      targetNow.id !== observedDescriptor.id
    );

    console.log(`old-handle-now-title=${oldHandleNow?.title || "ABSENT"}`);
    console.log(`target-current-handle=${targetNow?.id || "ABSENT"}`);
    console.log(`intentional-handle-rebound=${reboundPrepared ? "PASS" : "FAIL"}`);

    if (!reboundPrepared) {
      failed = true;
      return;
    }

    // This is the v66 behavior under test. The supplied descriptor contains an
    // intentionally stale positional id. The facade/plugin must re-resolve the
    // same physical descriptor and act through targetNow.id instead.
    const safeFocus = ComputerControl.focusWindow({
      app:"TextEdit",
      window:observedDescriptor,
    });

    console.log(`safe-focus=${safeFocus.ok ? "PASS" : "FAIL"}`);
    console.log(`safe-focus-state=${safeFocus.state || ""}`);
    console.log(`safe-focus-method=${safeFocus.method || ""}`);
    console.log(`safe-focus-verified=${safeFocus.verified === true}`);
    console.log(`safe-focus-verification=${safeFocus.verificationMethod || ""}`);
    console.log(`safe-focus-observed-handle=${safeFocus.observedHandle || ""}`);
    console.log(`safe-focus-action-handle=${safeFocus.actionHandle || ""}`);
    console.log(`safe-focus-handle-rebound=${safeFocus.handleRebound === true}`);
    console.log(`safe-focus-window=${JSON.stringify(safeFocus.window || null)}`);
    console.log(`safe-focus-native-window=${JSON.stringify(safeFocus.nativeWindow || null)}`);

    const rerouted = Boolean(
      safeFocus.ok &&
      safeFocus.state === "FOCUSED" &&
      safeFocus.verified === true &&
      safeFocus.verificationMethod === "native-focused-window-descriptor" &&
      safeFocus.observedHandle === observedDescriptor.id &&
      safeFocus.handleRebound === true &&
      safeFocus.actionHandle &&
      safeFocus.actionHandle !== observedDescriptor.id &&
      safeFocus.nativeWindow?.title === observedDescriptor.title &&
      safeFocus.nativeWindow?.process === observedDescriptor.process &&
      Number(safeFocus.nativeWindow?.pid || 0) === observedDescriptor.pid
    );

    console.log(`safe-focus-rebound-reroute=${rerouted ? "PASS" : "FAIL"}`);

    if (!rerouted) {
      console.log(`safe-focus-error=${safeFocus.error || safeFocus.detail || "safe focus contract not satisfied"}`);
      failed = true;
      return;
    }

    const finalFront = await waitForFrontDocument(observedDescriptor.title);
    console.log(`independent-front-document-after=${finalFront.name || ""}`);
    console.log(`independent-safe-focus-verification=${finalFront.ok ? "PASS" : "FAIL"}`);

    if (!finalFront.ok) {
      failed = true;
      return;
    }

    // The stale old handle points at another window in the immediately prior
    // raw observation. Therefore retaining the requested target in front is
    // direct physical evidence that v66 did not blindly act through the old id.
    const avoidedWrongWindow = oldHandleNow.title !== finalFront.name;
    console.log(`stale-handle-would-target=${oldHandleNow.title || ""}`);
    console.log(`wrong-window-avoided=${avoidedWrongWindow ? "PASS" : "FAIL"}`);

    if (!avoidedWrongWindow) {
      failed = true;
      return;
    }

    console.log("physical-safe-window-focus=PASS");
  } finally {
    const cleanup = closeFixtureDocuments();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);

    for (const file of [FIXTURE_A, FIXTURE_B]) {
      try { fs.unlinkSync(file); } catch (_) {}
    }

    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-safe-window-focus=FAIL");
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
