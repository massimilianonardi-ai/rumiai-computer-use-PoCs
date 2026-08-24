"use strict";

const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

async function main() {
  const desktop = loadDesktopPlugin();
  let failed = false;

  console.log(`desktop=${desktop.id} platform=${desktop.platform}`);

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);

  if (!runtime.ok) {
    console.log(`runtime-error=${runtime.error || runtime.detail || "unknown"}`);
    process.exit(1);
  }

  try {
    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);

    if (!ready.ok) {
      console.log(`application-error=${ready.error || ready.detail || "unknown"}`);
      failed = true;
      return;
    }

    // Guarantee that TextEdit owns a concrete observable window before testing
    // the public current-window API. This remains a generic Computer Control
    // keyboard operation; no platform-specific window call is made here.
    const newDocument = ComputerControl.press({
      app:"TextEdit",
      keys:"Cmd+N",
      settle:true,
    });
    console.log(`window-fixture=${newDocument.ok ? "PASS" : "FAIL"}`);

    if (!newDocument.ok) {
      console.log(`window-fixture-error=${newDocument.error || newDocument.detail || "unknown"}`);
      failed = true;
      return;
    }

    const observed = ComputerControl.getCurrentWindow({app:"TextEdit"});
    console.log(`window-observation=${observed.ok ? "PASS" : "FAIL"}`);
    console.log(`window-state=${observed.state || ""}`);
    console.log(`window-method=${observed.method || ""}`);
    console.log(`window=${JSON.stringify(observed.window || null)}`);

    if (!observed.ok || !observed.window) {
      console.log(`window-error=${observed.error || observed.detail || "current window unavailable"}`);
      failed = true;
      return;
    }

    console.log("physical-window-observation=PASS");
  } finally {
    const closed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${closed.ok ? "PASS" : "FAIL"}`);
    if (!closed.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error(`physical-window-observation=FAIL`);
  console.error(error && error.stack ? error.stack : String(error));
  try {
    const closed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${closed.ok ? "PASS" : "FAIL"}`);
  } catch (_) {
    // Best-effort cleanup after an unexpected test harness failure.
  }
  process.exit(1);
});
