"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

const FIXTURE_A = "/tmp/rumiai-v61-window-A.txt";
const FIXTURE_B = "/tmp/rumiai-v61-window-B.txt";
const TITLE_A = path.basename(FIXTURE_A);
const TITLE_B = path.basename(FIXTURE_B);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function openFixture(file) {
  const opened = spawnSync(
    "/usr/bin/open",
    ["-a", "TextEdit", file],
    {encoding:"utf8"}
  );

  return {
    ok:opened.status === 0,
    detail:String(opened.stderr || opened.stdout || "").trim(),
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

async function main() {
  const desktop = loadDesktopPlugin();
  let failed = false;

  console.log(`desktop=${desktop.id} platform=${desktop.platform}`);

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE_A, "RumiAI v61 facade fixture A\n", "utf8");
    fs.writeFileSync(FIXTURE_B, "RumiAI v61 facade fixture B\n", "utf8");

    const openedA = openFixture(FIXTURE_A);
    console.log(`fixture-A-open=${openedA.ok ? "PASS" : "FAIL"}`);
    if (!openedA.ok) {
      console.log(`fixture-A-error=${openedA.detail}`);
      failed = true;
      return;
    }

    const openedB = openFixture(FIXTURE_B);
    console.log(`fixture-B-open=${openedB.ok ? "PASS" : "FAIL"}`);
    if (!openedB.ok) {
      console.log(`fixture-B-error=${openedB.detail}`);
      failed = true;
      return;
    }

    await sleep(600);

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) {
      console.log(`application-ready-error=${ready.error || ready.detail || "unknown"}`);
      failed = true;
      return;
    }

    const listed = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`facade-window-list=${listed.ok ? "PASS" : "FAIL"}`);
    console.log(`facade-window-list-state=${listed.state || ""}`);
    console.log(`facade-window-list-method=${listed.method || ""}`);
    console.log(`facade-window-count=${Array.isArray(listed.windows) ? listed.windows.length : 0}`);
    console.log(`facade-windows=${JSON.stringify(listed.windows || [])}`);

    if (!listed.ok || !Array.isArray(listed.windows)) {
      console.log(`facade-window-list-error=${listed.error || listed.detail || "window list unavailable"}`);
      failed = true;
      return;
    }

    const fixtureWindows = listed.windows.filter(window =>
      window && (window.title === TITLE_A || window.title === TITLE_B)
    );
    const fixtureTitles = new Set(fixtureWindows.map(window => window.title));
    const fixtureIds = new Set(fixtureWindows.map(window => window.id).filter(Boolean));

    const hasA = fixtureTitles.has(TITLE_A);
    const hasB = fixtureTitles.has(TITLE_B);
    const distinctIds = fixtureIds.size >= 2;
    const normalized = fixtureWindows.length >= 2 && fixtureWindows.every(window =>
      typeof window.id === "string" && window.id.length > 0 &&
      (window.title === null || typeof window.title === "string") &&
      typeof window.process === "string" && window.process.length > 0 &&
      Number.isFinite(window.pid) && window.pid > 0 &&
      typeof window.focused === "boolean" &&
      typeof window.pinned === "boolean"
    );
    const hasPinned = fixtureWindows.some(window => window.pinned === true);

    console.log(`fixture-A-listed-through-facade=${hasA ? "PASS" : "FAIL"}`);
    console.log(`fixture-B-listed-through-facade=${hasB ? "PASS" : "FAIL"}`);
    console.log(`fixture-distinct-window-ids=${distinctIds ? "PASS" : "FAIL"}`);
    console.log(`fixture-normalized-fields=${normalized ? "PASS" : "FAIL"}`);
    console.log(`fixture-pinned-window=${hasPinned ? "PASS" : "FAIL"}`);

    if (!hasA || !hasB || !distinctIds || !normalized || !hasPinned) {
      failed = true;
      return;
    }

    console.log("physical-window-list-facade=PASS");
  } finally {
    const cleanup = closeFixtureDocuments();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);

    for (const file of [FIXTURE_A, FIXTURE_B]) {
      try {
        fs.unlinkSync(file);
      } catch (_) {
        // Test-only cleanup must not hide the physical result.
      }
    }

    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-window-list-facade=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try {
    closeFixtureDocuments();
  } catch (_) {}
  for (const file of [FIXTURE_A, FIXTURE_B]) {
    try {
      fs.unlinkSync(file);
    } catch (_) {}
  }
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
