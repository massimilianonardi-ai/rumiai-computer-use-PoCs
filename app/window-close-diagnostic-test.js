"use strict";

const ComputerControl = require("./computer-control");
const {loadDesktopPlugin} = require("./computer-control/desktop");

function fingerprint(window) {
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

function excerpt(snapshot) {
  return String(snapshot || "")
    .split("\n")
    .filter(line => /window|text-field|focused|Senza nome/i.test(line))
    .slice(0, 20)
    .join(" | ");
}

async function main() {
  const desktop = loadDesktopPlugin();
  let failed = false;

  console.log(`desktop=${desktop.id} platform=${desktop.platform}`);

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    const ready = await ComputerControl.ensureReady("TextEdit");
    console.log(`application-ready=${ready.ok ? "PASS" : "FAIL"}`);
    if (!ready.ok) {
      failed = true;
      return;
    }

    const fixture = ComputerControl.press({
      app:"TextEdit",
      keys:"Cmd+N",
      settle:true,
    });
    console.log(`window-fixture=${fixture.ok ? "PASS" : "FAIL"}`);
    if (!fixture.ok) {
      failed = true;
      return;
    }

    const beforeWindow = ComputerControl.getCurrentWindow({app:"TextEdit"});
    const beforeSnapshot = ComputerControl.snapshot({
      app:"TextEdit",
      settle:true,
      compact:true,
    });

    console.log(`before-window-ok=${beforeWindow.ok ? "true" : "false"}`);
    console.log(`before-window=${JSON.stringify(beforeWindow.window || null)}`);
    console.log(`before-fingerprint=${fingerprint(beforeWindow.window) || ""}`);
    console.log(`before-snapshot-ok=${beforeSnapshot.ok ? "true" : "false"}`);
    console.log(`before-snapshot-excerpt=${excerpt(beforeSnapshot.snapshot)}`);

    const closed = ComputerControl.closeWindow({app:"TextEdit"});

    console.log(`close-ok=${closed.ok ? "true" : "false"}`);
    console.log(`close-state=${closed.state || ""}`);
    console.log(`close-error=${closed.error || ""}`);
    console.log(`close-method=${closed.method || ""}`);
    console.log(`close-verified=${closed.verified === true ? "true" : "false"}`);
    console.log(`plugin-before-window=${JSON.stringify(closed.window || null)}`);
    console.log(`plugin-after-window=${JSON.stringify(closed.currentWindow || null)}`);

    const foreground = ComputerControl.getForeground();
    const afterWindow = ComputerControl.getCurrentWindow({app:"TextEdit"});
    const afterSnapshot = ComputerControl.snapshot({
      app:"TextEdit",
      settle:true,
      compact:true,
      previousSnapshot:beforeSnapshot.ok ? beforeSnapshot.snapshot : null,
    });

    console.log(`after-foreground-ok=${foreground.ok ? "true" : "false"}`);
    console.log(`after-foreground=${foreground.name || ""} ${foreground.bundle || ""}`.trim());
    console.log(`after-window-ok=${afterWindow.ok ? "true" : "false"}`);
    console.log(`after-window=${JSON.stringify(afterWindow.window || null)}`);
    console.log(`after-fingerprint=${fingerprint(afterWindow.window) || ""}`);
    console.log(`after-snapshot-ok=${afterSnapshot.ok ? "true" : "false"}`);
    console.log(`after-snapshot-changed=${afterSnapshot.changed === null ? "null" : String(afterSnapshot.changed)}`);
    console.log(`after-snapshot-excerpt=${excerpt(afterSnapshot.snapshot)}`);

    if (beforeSnapshot.ok) {
      const changed = await ComputerControl.waitUntilChanged(
        "TextEdit",
        beforeSnapshot.snapshot,
        {timeoutMs:3000, pollMs:100, compact:true}
      );
      console.log(`wait-until-changed=${changed.ok ? "CHANGED" : "NOT_CHANGED"}`);
      console.log(`wait-until-changed-attempts=${changed.attempts || changed.diagnostics?.attempts || 0}`);
      console.log(`wait-until-changed-error=${changed.ok ? "" : (changed.error || changed.detail || "")}`);
    }

    console.log("diagnostic-complete=PASS");
  } finally {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
    if (!stopped.ok) failed = true;
    process.exitCode = failed ? 1 : 0;
  }
}

main().catch(error => {
  console.error("diagnostic-complete=FAIL");
  console.error(error && error.stack ? error.stack : String(error));
  try {
    const stopped = ComputerControl.shutdownRuntime();
    console.log(`runtime-close=${stopped.ok ? "PASS" : "FAIL"}`);
  } catch (_) {}
  process.exit(1);
});
