"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");

const FIXTURE = "/tmp/rumiai-v69-native-minimize.txt";
const TITLE = path.basename(FIXTURE);
const HELPER_SOURCE = path.resolve(__dirname, "..", "tools", "macos-window-minimized.swift");
const HELPER_BIN = "/tmp/rumiai-v69-macos-window-minimized";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compileHelper() {
  const result = spawnSync(
    "/usr/bin/xcrun",
    ["swiftc", HELPER_SOURCE, "-o", HELPER_BIN],
    {encoding:"utf8"}
  );

  return {
    ok:result.status === 0,
    detail:String(result.stderr || result.stdout || "").trim(),
  };
}

function runHelper(pid, mode) {
  const result = spawnSync(
    HELPER_BIN,
    [String(pid), TITLE, mode],
    {encoding:"utf8"}
  );

  const stdout = String(result.stdout || "").trim();
  let data = null;
  try { data = JSON.parse(stdout); } catch (_) {}

  return {
    ok:result.status === 0 && data?.ok === true,
    data,
    detail:String(result.stderr || stdout || "").trim(),
  };
}

function openFixture() {
  const result = spawnSync(
    "/usr/bin/open",
    ["-a", "TextEdit", FIXTURE],
    {encoding:"utf8"}
  );

  return {
    ok:result.status === 0,
    detail:String(result.stderr || result.stdout || "").trim(),
  };
}

function independentMinimizedState() {
  const script = `
    tell application "System Events"
      tell process "TextEdit"
        repeat with w in windows
          try
            if name of w is "${TITLE}" then
              return value of attribute "AXMinimized" of w
            end if
          end try
        end repeat
      end tell
    end tell
    return "NOT_FOUND"
  `;

  const result = spawnSync(
    "/usr/bin/osascript",
    ["-e", script],
    {encoding:"utf8"}
  );

  const value = String(result.stdout || "").trim().toLowerCase();
  return {
    ok:result.status === 0 && (value === "true" || value === "false"),
    minimized:value === "true",
    raw:value,
    detail:String(result.stderr || "").trim(),
  };
}

async function waitForHelperState(pid, expected, timeoutMs = 3000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;

  while ((performance.now() - started) <= timeoutMs) {
    last = runHelper(pid, "observe");
    attempts += 1;
    if (last.ok && last.data?.minimizedAfter === expected) {
      return {ok:true, attempts, observation:last.data};
    }
    await sleep(75);
  }

  return {ok:false, attempts, observation:last?.data || null, detail:last?.detail || ""};
}

async function waitForIndependentState(expected, timeoutMs = 3000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;

  while ((performance.now() - started) <= timeoutMs) {
    last = independentMinimizedState();
    attempts += 1;
    if (last.ok && last.minimized === expected) {
      return {ok:true, attempts, state:last};
    }
    await sleep(75);
  }

  return {ok:false, attempts, state:last};
}

function cleanupFixture() {
  const script = `
    tell application "TextEdit"
      repeat with d in documents
        if name of d is "${TITLE}" then close d saving no
      end repeat
    end tell
  `;
  return spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
}

async function main() {
  let failed = false;
  let pid = 0;

  const compiled = compileHelper();
  console.log(`native-helper-compile=${compiled.ok ? "PASS" : "FAIL"}`);
  if (!compiled.ok) {
    console.log(`native-helper-compile-error=${compiled.detail || "unknown"}`);
    process.exit(1);
  }

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE, "RumiAI v69 native minimize fixture\n", "utf8");

    const opened = openFixture();
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

    const fixtureWindow = Array.isArray(listed.windows)
      ? listed.windows.find(window => window?.title === TITLE) || null
      : null;

    pid = Number(fixtureWindow?.pid || 0);
    console.log(`fixture-title=${fixtureWindow?.title || ""}`);
    console.log(`fixture-pid=${pid || 0}`);
    console.log(`minimize-fixture-ready=${fixtureWindow && pid > 0 ? "PASS" : "FAIL"}`);

    if (!fixtureWindow || pid <= 0) {
      failed = true;
      return;
    }

    const before = runHelper(pid, "observe");
    console.log(`native-observe-before=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-before=${before.data?.minimizedAfter}`);
    console.log(`native-settable=${before.data?.settable === true}`);

    if (!before.ok || before.data?.minimizedAfter !== false) {
      console.log(`native-observe-before-error=${before.detail || "unexpected initial state"}`);
      failed = true;
      return;
    }

    const independentBefore = independentMinimizedState();
    console.log(`independent-before=${independentBefore.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized-before=${independentBefore.minimized}`);

    if (!independentBefore.ok || independentBefore.minimized !== false) {
      console.log(`independent-before-error=${independentBefore.detail || independentBefore.raw || "unexpected initial state"}`);
      failed = true;
      return;
    }

    const minimize = runHelper(pid, "minimize");
    console.log(`native-minimize-action=${minimize.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimize-method=${minimize.data?.method || ""}`);
    console.log(`native-minimize-before=${minimize.data?.minimizedBefore}`);
    console.log(`native-minimize-after-immediate=${minimize.data?.minimizedAfter}`);

    if (!minimize.ok) {
      console.log(`native-minimize-action-error=${minimize.detail || "unknown"}`);
      failed = true;
      return;
    }

    const minimized = await waitForHelperState(pid, true);
    console.log(`native-minimized-state=${minimized.ok ? "PASS" : "FAIL"}`);
    console.log(`native-minimized-attempts=${minimized.attempts}`);
    console.log(`native-minimized-observed=${minimized.observation?.minimizedAfter}`);

    const independentMinimized = await waitForIndependentState(true);
    console.log(`independent-minimized-state=${independentMinimized.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-minimized-attempts=${independentMinimized.attempts}`);
    console.log(`independent-minimized-observed=${independentMinimized.state?.minimized}`);

    if (!minimized.ok || !independentMinimized.ok) {
      failed = true;
      return;
    }

    console.log("physical-window-minimize=PASS");

    const restore = runHelper(pid, "restore");
    console.log(`native-restore-action=${restore.ok ? "PASS" : "FAIL"}`);
    console.log(`native-restore-before=${restore.data?.minimizedBefore}`);
    console.log(`native-restore-after-immediate=${restore.data?.minimizedAfter}`);

    if (!restore.ok) {
      console.log(`native-restore-action-error=${restore.detail || "unknown"}`);
      failed = true;
      return;
    }

    const restored = await waitForHelperState(pid, false);
    console.log(`native-restored-state=${restored.ok ? "PASS" : "FAIL"}`);
    console.log(`native-restored-attempts=${restored.attempts}`);
    console.log(`native-restored-observed=${restored.observation?.minimizedAfter}`);

    const independentRestored = await waitForIndependentState(false);
    console.log(`independent-restored-state=${independentRestored.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-restored-attempts=${independentRestored.attempts}`);
    console.log(`independent-restored-observed=${independentRestored.state?.minimized}`);

    if (!restored.ok || !independentRestored.ok) {
      failed = true;
      return;
    }

    console.log("physical-window-restore=PASS");
    console.log("physical-native-window-minimize-primitive=PASS");
  } finally {
    if (pid > 0) {
      try { runHelper(pid, "restore"); } catch (_) {}
    }

    const cleanup = cleanupFixture();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);

    try { fs.unlinkSync(FIXTURE); } catch (_) {}
    try { fs.unlinkSync(HELPER_BIN); } catch (_) {}

    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-native-window-minimize-primitive=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { cleanupFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try { fs.unlinkSync(HELPER_BIN); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
