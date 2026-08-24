"use strict";

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const ComputerControl = require("./computer-control");

const FIXTURE_A = "/tmp/rumiai-v65-native-focus-A.txt";
const FIXTURE_B = "/tmp/rumiai-v65-native-focus-B.txt";
const TITLE_A = path.basename(FIXTURE_A);
const TITLE_B = path.basename(FIXTURE_B);
const HELPER_SOURCE = path.resolve(__dirname, "..", "tools", "macos-focused-window.swift");
const HELPER_BIN = "/tmp/rumiai-v65-macos-focused-window";

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

function compileHelper() {
  const find = spawnSync(
    "/usr/bin/xcrun",
    ["--find", "swiftc"],
    {encoding:"utf8"}
  );

  if (find.status !== 0) {
    return {
      ok:false,
      detail:String(find.stderr || find.stdout || "swiftc unavailable").trim(),
    };
  }

  const compiled = spawnSync(
    "/usr/bin/xcrun",
    ["swiftc", HELPER_SOURCE, "-o", HELPER_BIN],
    {encoding:"utf8"}
  );

  return {
    ok:compiled.status === 0,
    detail:String(compiled.stderr || compiled.stdout || "").trim(),
  };
}

function nativeFocusedWindow() {
  const result = spawnSync(
    HELPER_BIN,
    [],
    {encoding:"utf8"}
  );

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();

  if (result.status !== 0) {
    let data = null;
    try { data = JSON.parse(stdout); } catch (_) {}
    return {
      ok:false,
      data,
      detail:stderr || stdout || `helper exit ${result.status}`,
    };
  }

  try {
    const data = JSON.parse(stdout);
    return {
      ok:data?.ok === true,
      data,
      detail:data?.ok === true ? "" : (data?.error || "native observer failed"),
    };
  } catch (error) {
    return {
      ok:false,
      data:null,
      detail:`invalid helper JSON: ${error.message}; stdout=${stdout}`,
    };
  }
}

async function waitForNativeFocusedTitle(expected, timeoutMs = 3000) {
  const started = performance.now();
  let attempts = 0;
  let last = null;

  while ((performance.now() - started) < timeoutMs) {
    last = nativeFocusedWindow();
    attempts += 1;

    if (last.ok && last.data?.title === expected) {
      return {
        ok:true,
        data:last.data,
        attempts,
        elapsedMs:performance.now() - started,
      };
    }

    await sleep(100);
  }

  return {
    ok:false,
    data:last?.data || null,
    detail:last?.detail || "",
    attempts,
    elapsedMs:performance.now() - started,
  };
}

async function main() {
  let failed = false;

  const compiled = compileHelper();
  console.log(`native-helper-compile=${compiled.ok ? "PASS" : "FAIL"}`);
  if (!compiled.ok) {
    console.log(`native-helper-compile-error=${compiled.detail}`);
    process.exit(1);
  }

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    fs.writeFileSync(FIXTURE_A, "RumiAI v65 native focus fixture A\n", "utf8");
    fs.writeFileSync(FIXTURE_B, "RumiAI v65 native focus fixture B\n", "utf8");

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
    console.log(`native-focus-fixture-ready=${fixtureReady ? "PASS" : "FAIL"}`);

    if (!fixtureReady) {
      failed = true;
      return;
    }

    const nativeBefore = nativeFocusedWindow();
    console.log(`native-focused-before=${nativeBefore.ok ? "PASS" : "FAIL"}`);
    console.log(`native-focused-before-data=${JSON.stringify(nativeBefore.data || null)}`);
    if (!nativeBefore.ok) {
      console.log(`native-focused-before-error=${nativeBefore.detail}`);
      failed = true;
      return;
    }

    const independentBefore = frontDocumentName();
    console.log(`independent-front-document-before=${independentBefore.name || ""}`);
    console.log(`native-before-independent-match=${
      independentBefore.ok && independentBefore.name === nativeBefore.data?.title
        ? "PASS"
        : "FAIL"
    }`);

    const focused = ComputerControl.focusWindow({
      app:"TextEdit",
      window:{id:target.id},
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

    const nativeAfter = await waitForNativeFocusedTitle(target.title);
    console.log(`native-focused-after=${nativeAfter.ok ? "PASS" : "FAIL"}`);
    console.log(`native-focused-after-attempts=${nativeAfter.attempts}`);
    console.log(`native-focused-after-data=${JSON.stringify(nativeAfter.data || null)}`);

    if (!nativeAfter.ok) {
      console.log(`native-focused-after-error=${nativeAfter.detail || "focused AX window did not become target"}`);
      failed = true;
      return;
    }

    const targetMatch = Boolean(
      nativeAfter.data?.pid === Number(target.pid) &&
      nativeAfter.data?.title === target.title &&
      String(nativeAfter.data?.process || "") === String(target.process || "")
    );

    console.log(`native-focused-target-match=${targetMatch ? "PASS" : "FAIL"}`);
    console.log(`native-focused-identifier=${nativeAfter.data?.identifier ?? "ABSENT"}`);
    console.log(`native-focused-window-number=${nativeAfter.data?.windowNumber ?? "ABSENT"}`);

    const independentAfter = frontDocumentName();
    const independentMatch = Boolean(
      independentAfter.ok && independentAfter.name === target.title
    );
    console.log(`independent-front-document-after=${independentAfter.name || ""}`);
    console.log(`independent-focus-verification=${independentMatch ? "PASS" : "FAIL"}`);

    if (!targetMatch || !independentMatch) {
      failed = true;
      return;
    }

    console.log("diagnostic-complete=PASS");
  } finally {
    const cleanup = closeFixtureDocuments();
    console.log(`fixture-cleanup=${cleanup.status === 0 ? "PASS" : "WARN"}`);

    for (const file of [FIXTURE_A, FIXTURE_B, HELPER_BIN]) {
      try { fs.unlinkSync(file); } catch (_) {}
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
  for (const file of [FIXTURE_A, FIXTURE_B, HELPER_BIN]) {
    try { fs.unlinkSync(file); } catch (_) {}
  }
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
