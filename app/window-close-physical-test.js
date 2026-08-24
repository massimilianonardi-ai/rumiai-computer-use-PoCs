"use strict";

const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

function windowFingerprint(window) {
  if (!window) return null;
  const value = window?.value || window;
  const id = value?.id || window?.id || null;
  if (id) return `id:${id}`;
  try {
    return `json:${JSON.stringify(window)}`;
  } catch (_) {
    return `string:${String(window)}`;
  }
}

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

    const before = ComputerControl.getCurrentWindow({app:"TextEdit"});
    console.log(`before-window-observation=${before.ok ? "PASS" : "FAIL"}`);
    console.log(`before-window=${JSON.stringify(before.window || null)}`);

    if (!before.ok || !before.window) {
      console.log(`before-window-error=${before.error || before.detail || "current window unavailable"}`);
      failed = true;
      return;
    }

    const beforeFingerprint = windowFingerprint(before.window);
    console.log(`before-fingerprint=${beforeFingerprint || ""}`);

    const closed = ComputerControl.closeWindow({app:"TextEdit"});
    console.log(`window-close=${closed.ok ? "PASS" : "FAIL"}`);
    console.log(`window-close-state=${closed.state || ""}`);
    console.log(`window-close-method=${closed.method || ""}`);
    console.log(`window-close-verified=${closed.verified === true ? "true" : "false"}`);
    console.log(`window-close-verification=${closed.verificationMethod || ""}`);
    console.log(`closed-window=${JSON.stringify(closed.window || null)}`);
    console.log(`plugin-current-window=${JSON.stringify(closed.currentWindow || null)}`);

    if (!closed.ok || closed.verified !== true) {
      console.log(`window-close-error=${closed.error || closed.detail || "window close not verified"}`);
      failed = true;
      return;
    }

    const after = ComputerControl.getCurrentWindow({app:"TextEdit"});
    const afterFingerprint = after.ok && after.window
      ? windowFingerprint(after.window)
      : null;

    console.log(`after-window-observation=${after.ok ? "OBSERVED" : "ABSENT"}`);
    console.log(`after-window=${JSON.stringify(after.window || null)}`);
    console.log(`after-fingerprint=${afterFingerprint || ""}`);

    const independentlyVerified =
      !after.ok ||
      !after.window ||
      (
        beforeFingerprint !== null &&
        afterFingerprint !== null &&
        beforeFingerprint !== afterFingerprint
      );

    console.log(`independent-close-verification=${independentlyVerified ? "PASS" : "FAIL"}`);

    if (!independentlyVerified) {
      failed = true;
      return;
    }

    console.log("physical-window-close=PASS");
  } finally {
    const runtimeClosed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${runtimeClosed.ok ? "PASS" : "FAIL"}`);
    if (!runtimeClosed.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("physical-window-close=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try {
    const runtimeClosed = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${runtimeClosed.ok ? "PASS" : "FAIL"}`);
  } catch (_) {
    // Best-effort cleanup after an unexpected test harness failure.
  }
  process.exit(1);
});
