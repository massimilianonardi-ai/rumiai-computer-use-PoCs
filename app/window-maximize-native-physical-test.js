"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");

const FIXTURE = "/tmp/rumiai-v74-native-maximize.txt";
const TITLE = path.basename(FIXTURE);
const HELPER_SOURCE = path.resolve(__dirname, "..", "tools", "macos-window-bounds.swift");
const HELPER_BIN = "/tmp/rumiai-v74-macos-window-bounds";
const TOLERANCE = 3;

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

function runHelper(pid, mode, bounds = null) {
  const args = [String(pid), TITLE, mode];
  if (mode === "set" && bounds) {
    args.push(String(bounds.x), String(bounds.y), String(bounds.width), String(bounds.height));
  }
  const result = spawnSync(HELPER_BIN, args, {encoding:"utf8"});
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
  const result = spawnSync("/usr/bin/open", ["-a", "TextEdit", FIXTURE], {encoding:"utf8"});
  return {ok:result.status === 0, detail:String(result.stderr || result.stdout || "").trim()};
}

function closeFixture() {
  const script = `
    tell application "TextEdit"
      repeat with d in documents
        if name of d is "${TITLE}" then close d saving no
      end repeat
    end tell
  `;
  return spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
}

function independentBounds() {
  const script = `
    tell application "System Events"
      tell process "TextEdit"
        set matches to every window whose name is "${TITLE}"
        if (count of matches) is not 1 then return "AMBIGUOUS"
        set p to position of item 1 of matches
        set s to size of item 1 of matches
        return (item 1 of p as text) & "," & (item 2 of p as text) & "," & ¬
          (item 1 of s as text) & "," & (item 2 of s as text)
      end tell
    end tell
  `;
  const result = spawnSync("/usr/bin/osascript", ["-e", script], {encoding:"utf8"});
  const raw = String(result.stdout || "").trim();
  const values = raw.split(",").map(Number);
  const valid = result.status === 0 && values.length === 4 && values.every(Number.isFinite);
  return {
    ok:valid,
    bounds:valid ? {x:values[0], y:values[1], width:values[2], height:values[3]} : null,
    detail:String(result.stderr || raw || "").trim(),
  };
}

function boundsEqual(left, right, tolerance = TOLERANCE) {
  if (!left || !right) return false;
  return ["x", "y", "width", "height"].every(
    key => Math.abs(Number(left[key]) - Number(right[key])) <= tolerance
  );
}

async function waitForNativeBounds(pid, expected, timeoutMs = 4000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;
  while ((performance.now() - started) <= timeoutMs) {
    last = runHelper(pid, "observe");
    attempts += 1;
    if (last.ok && boundsEqual(last.data?.after, expected)) {
      return {ok:true, attempts, bounds:last.data.after};
    }
    await sleep(75);
  }
  return {ok:false, attempts, bounds:last?.data?.after || null, detail:last?.detail || ""};
}

async function waitForIndependentBounds(expected, timeoutMs = 4000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;
  while ((performance.now() - started) <= timeoutMs) {
    last = independentBounds();
    attempts += 1;
    if (last.ok && boundsEqual(last.bounds, expected)) {
      return {ok:true, attempts, bounds:last.bounds};
    }
    await sleep(75);
  }
  return {ok:false, attempts, bounds:last?.bounds || null, detail:last?.detail || ""};
}

async function main() {
  let failed = false;
  let pid = 0;
  let original = null;

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
    fs.writeFileSync(FIXTURE, "RumiAI v74 native maximize fixture\n", "utf8");
    const opened = openFixture();
    console.log(`fixture-open=${opened.ok ? "PASS" : "FAIL"}`);
    if (!opened.ok) { failed = true; return; }

    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) { failed = true; return; }

    const listed = ComputerControl.listWindows({app:"TextEdit"});
    console.log(`window-list=${listed.ok ? "PASS" : "FAIL"}`);
    const target = (listed.windows || []).find(window => window?.title === TITLE) || null;
    pid = Number(target?.pid || 0);
    console.log(`fixture-title=${TITLE}`);
    console.log(`fixture-pid=${pid || 0}`);
    console.log(`maximize-fixture-ready=${target && pid > 0 ? "PASS" : "FAIL"}`);
    if (!target || pid <= 0) { failed = true; return; }

    const observed = runHelper(pid, "observe");
    original = observed.data?.after || null;
    console.log(`native-observe-before=${observed.ok ? "PASS" : "FAIL"}`);
    console.log(`native-original-bounds=${JSON.stringify(original)}`);
    console.log(`native-position-settable=${observed.data?.positionSettable === true}`);
    console.log(`native-size-settable=${observed.data?.sizeSettable === true}`);
    if (!observed.ok || !original) { failed = true; return; }

    const prepared = {
      x:Math.round(original.x + 40),
      y:Math.round(original.y + 40),
      width:Math.max(420, Math.min(720, Math.round(original.width * 0.72))),
      height:Math.max(320, Math.min(520, Math.round(original.height * 0.72))),
    };
    const prepareAction = runHelper(pid, "set", prepared);
    console.log(`fixture-prepare-action=${prepareAction.ok ? "PASS" : "FAIL"}`);
    if (!prepareAction.ok) { failed = true; return; }
    const preparedNative = await waitForNativeBounds(pid, prepared);
    const preparedIndependent = await waitForIndependentBounds(prepared);
    console.log(`fixture-prepared-native=${preparedNative.ok ? "PASS" : "FAIL"}`);
    console.log(`fixture-prepared-independent=${preparedIndependent.ok ? "PASS" : "FAIL"}`);
    console.log(`fixture-prepared-bounds=${JSON.stringify(preparedNative.bounds)}`);
    if (!preparedNative.ok || !preparedIndependent.ok) { failed = true; return; }

    const maximize = runHelper(pid, "maximize");
    const desired = maximize.data?.desired || null;
    console.log(`native-maximize-action=${maximize.ok ? "PASS" : "FAIL"}`);
    console.log(`native-maximize-method=${maximize.data?.method || ""}`);
    console.log(`native-maximize-before=${JSON.stringify(maximize.data?.before || null)}`);
    console.log(`native-maximize-desired=${JSON.stringify(desired)}`);
    console.log(`native-maximize-after-immediate=${JSON.stringify(maximize.data?.after || null)}`);
    if (!maximize.ok || !desired) { failed = true; return; }

    const transitioned = !boundsEqual(prepared, desired);
    console.log(`native-maximize-transition-required=${transitioned ? "PASS" : "FAIL"}`);
    const nativeMaximized = await waitForNativeBounds(pid, desired);
    console.log(`native-maximized-state=${nativeMaximized.ok ? "PASS" : "FAIL"}`);
    console.log(`native-maximized-attempts=${nativeMaximized.attempts}`);
    console.log(`native-maximized-observed=${JSON.stringify(nativeMaximized.bounds)}`);
    const independentMaximized = await waitForIndependentBounds(desired);
    console.log(`independent-maximized-state=${independentMaximized.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-maximized-attempts=${independentMaximized.attempts}`);
    console.log(`independent-maximized-observed=${JSON.stringify(independentMaximized.bounds)}`);
    if (!transitioned || !nativeMaximized.ok || !independentMaximized.ok) {
      failed = true;
      return;
    }
    console.log("physical-window-maximize=PASS");

    const restore = runHelper(pid, "set", original);
    console.log(`native-restore-bounds-action=${restore.ok ? "PASS" : "FAIL"}`);
    if (!restore.ok) { failed = true; return; }
    const nativeRestored = await waitForNativeBounds(pid, original);
    const independentRestored = await waitForIndependentBounds(original);
    console.log(`native-restored-bounds=${nativeRestored.ok ? "PASS" : "FAIL"}`);
    console.log(`independent-restored-bounds=${independentRestored.ok ? "PASS" : "FAIL"}`);
    console.log(`physical-native-window-maximize-primitive=${nativeRestored.ok && independentRestored.ok ? "PASS" : "FAIL"}`);
    if (!nativeRestored.ok || !independentRestored.ok) failed = true;
  } finally {
    if (pid > 0 && original) {
      try { runHelper(pid, "set", original); } catch (_) {}
    }
    const cleanup = closeFixture();
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
  console.error("physical-native-window-maximize-primitive=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try { closeFixture(); } catch (_) {}
  try { fs.unlinkSync(FIXTURE); } catch (_) {}
  try { fs.unlinkSync(HELPER_BIN); } catch (_) {}
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
