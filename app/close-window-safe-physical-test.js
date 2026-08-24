"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");

const FIXTURE_A = "/tmp/rumiai-v68-safe-close-A.txt";
const FIXTURE_B = "/tmp/rumiai-v68-safe-close-B.txt";
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

function documentNames() {
  const script = `
    tell application "TextEdit"
      if (count of documents) is 0 then return ""
      set output to ""
      repeat with d in documents
        if output is not "" then set output to output & linefeed
        set output to output & (name of d as text)
      end repeat
      return output
    end tell
  `;

  const result = spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );

  return {
    ok:result.status === 0,
    names:String(result.stdout || "")
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean),
    detail:String(result.stderr || "").trim(),
  };
}

async function waitForDocumentState(closedTitle, survivorTitle, timeoutMs = 3000) {
  const started = performance.now();
  let attempts = 0;
  let last = documentNames();

  while ((performance.now() - started) < timeoutMs) {
    last = documentNames();
    attempts += 1;

    if (
      last.ok &&
      !last.names.includes(closedTitle) &&
      last.names.includes(survivorTitle)
    ) {
      return {
        ok:true,
        names:last.names,
        attempts,
      };
    }

    await sleep(100);
  }

  return {
    ok:false,
    names:last.names || [],
    detail:last.detail || "",
    attempts,
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

function descriptorCount(windows, title, process, pid) {
  return (Array.isArray(windows) ? windows : []).filter(window =>
    window?.title === title &&
    String(window?.process || "") === String(process || "") &&
    Number(window?.pid || 0) === Number(pid || 0)
  ).length;
}

async function main() {
  let failed = false;

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE_A, "RumiAI v68 safe close fixture A\n", "utf8");
    fs.writeFileSync(FIXTURE_B, "RumiAI v68 safe close fixture B\n", "utf8");

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

    const fixtureWindows = before.windows.filter(window =>
      window && (window.title === TITLE_A || window.title === TITLE_B)
    );

    const frontBefore = frontDocumentName();
    console.log(`front-document-before-ok=${frontBefore.ok ? "true" : "false"}`);
    console.log(`front-document-before=${frontBefore.name || ""}`);

    if (!frontBefore.ok || ![TITLE_A, TITLE_B].includes(frontBefore.name)) {
      console.log("close-fixture-ready=FAIL");
      failed = true;
      return;
    }

    const closedTitle = frontBefore.name;
    const survivorTitle = closedTitle === TITLE_A ? TITLE_B : TITLE_A;
    const closedBefore = fixtureWindows.find(window => window.title === closedTitle) || null;
    const survivorBefore = fixtureWindows.find(window => window.title === survivorTitle) || null;

    const fixtureReady = Boolean(
      fixtureWindows.length >= 2 &&
      closedBefore?.id &&
      survivorBefore?.id &&
      closedBefore.id !== survivorBefore.id
    );

    console.log(`fixture-window-count=${fixtureWindows.length}`);
    console.log(`closed-title=${closedTitle}`);
    console.log(`closed-before-handle=${closedBefore?.id || ""}`);
    console.log(`survivor-title=${survivorTitle}`);
    console.log(`survivor-before-handle=${survivorBefore?.id || ""}`);
    console.log(`close-fixture-ready=${fixtureReady ? "PASS" : "FAIL"}`);

    if (!fixtureReady) {
      failed = true;
      return;
    }

    const countBefore = descriptorCount(
      before.windows,
      closedBefore.title,
      closedBefore.process,
      closedBefore.pid
    );
    console.log(`closed-descriptor-count-before=${countBefore}`);

    const closeResult = ComputerControl.closeWindow({app:"TextEdit"});
    console.log(`safe-close=${closeResult.ok ? "PASS" : "FAIL"}`);
    console.log(`safe-close-state=${closeResult.state || ""}`);
    console.log(`safe-close-error=${closeResult.error || ""}`);
    console.log(`safe-close-verified=${closeResult.verified === true}`);
    console.log(`safe-close-verification=${closeResult.verificationMethod || ""}`);
    console.log(`safe-close-window=${JSON.stringify(closeResult.window || null)}`);

    const physical = await waitForDocumentState(closedTitle, survivorTitle);
    console.log(`independent-documents-after=${JSON.stringify(physical.names || [])}`);
    console.log(`independent-close-attempts=${physical.attempts}`);
    console.log(`independent-physical-close=${physical.ok ? "PASS" : "FAIL"}`);

    const after = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`after-window-list=${after.ok ? "PASS" : "FAIL"}`);
    console.log(`after-window-count=${Array.isArray(after.windows) ? after.windows.length : 0}`);
    console.log(`after-windows=${JSON.stringify(after.windows || [])}`);

    const survivorAfter = Array.isArray(after.windows)
      ? after.windows.find(window => window?.title === survivorTitle) || null
      : null;

    const sameHandleReused = Boolean(
      physical.ok &&
      closedBefore?.id &&
      survivorAfter?.id &&
      closedBefore.id === survivorAfter.id
    );

    const countAfter = after.ok
      ? descriptorCount(
          after.windows,
          closedBefore.title,
          closedBefore.process,
          closedBefore.pid
        )
      : -1;

    const countDecrease = countAfter === countBefore - 1;
    const publicVerified = Boolean(
      closeResult.ok &&
      closeResult.state === "CLOSED" &&
      closeResult.verified === true &&
      closeResult.verificationMethod === "window-descriptor-count-decreased"
    );

    console.log(`survivor-after-handle=${survivorAfter?.id || ""}`);
    console.log(`closed-handle-reused-by-survivor=${sameHandleReused ? "true" : "false"}`);
    console.log(`closed-descriptor-count-after=${countAfter}`);
    console.log(`descriptor-count-decrease=${countDecrease ? "PASS" : "FAIL"}`);
    console.log(`safe-close-public-postcondition=${publicVerified ? "PASS" : "FAIL"}`);

    const fixedFalseNegative = Boolean(
      sameHandleReused &&
      physical.ok &&
      countDecrease &&
      publicVerified
    );

    console.log(`v67-false-negative-fixed=${fixedFalseNegative ? "PASS" : "FAIL"}`);
    console.log(`physical-safe-close-window=${fixedFalseNegative ? "PASS" : "FAIL"}`);

    if (!fixedFalseNegative) failed = true;
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
  console.error("physical-safe-close-window=FAIL");
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
