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

function establishWindowFixture(desktop) {
  const provider = ComputerControl.resolveApplicationProvider("TextEdit");
  if (!provider) {
    return {ok:false, error:"PROVIDER_NOT_FOUND"};
  }

  const resolved = desktop.resolveApplication({provider});
  if (!resolved?.ok || !resolved.identity) {
    return {
      ok:false,
      error:resolved?.error || "APP_RESOLVE_FAILED",
      detail:resolved?.detail || "TextEdit resolution failed",
    };
  }

  const application = {
    ...resolved,
    provider,
    identity:resolved.identity,
  };

  let activated = desktop.activateApplication(application);
  if (!activated?.ok) {
    const launched = desktop.launchApplication(application);
    if (!launched?.ok) {
      return {
        ok:false,
        error:launched?.error || "APP_LAUNCH_FAILED",
        detail:launched?.detail || launched?.stderr || launched?.stdout || "TextEdit launch failed",
      };
    }
    activated = desktop.activateApplication(application);
  }

  if (!activated?.ok) {
    return {
      ok:false,
      error:activated?.error || "APP_ACTIVATE_FAILED",
      detail:activated?.detail || activated?.stderr || activated?.stdout || "TextEdit activation failed",
    };
  }

  const foreground = ComputerControl.getForeground();
  const fixture = ComputerControl.press({
    app:"TextEdit",
    keys:"Cmd+N",
    settle:true,
  });

  return {
    ok:fixture.ok,
    provider,
    resolved,
    activated,
    foreground,
    fixture,
    error:fixture.ok ? null : (fixture.error || "WINDOW_FIXTURE_FAILED"),
    detail:fixture.detail || null,
  };
}

async function main() {
  const desktop = loadDesktopPlugin();
  let failed = false;

  console.log(`desktop=${desktop.id} platform=${desktop.platform}`);

  const runtime = ComputerControl.ensureRuntime();
  console.log(`runtime-ready=${runtime.ok ? "PASS" : "FAIL"}`);
  if (!runtime.ok) process.exit(1);

  try {
    const prepared = establishWindowFixture(desktop);
    console.log(`application-resolved=${prepared.resolved?.ok ? "PASS" : "FAIL"}`);
    console.log(`application-activated=${prepared.activated?.ok ? "PASS" : "FAIL"}`);
    console.log(
      `fixture-foreground=${prepared.foreground?.ok ? `${prepared.foreground.name || ""} ${prepared.foreground.bundle || ""}`.trim() : "UNAVAILABLE"}`
    );
    console.log(`window-fixture=${prepared.ok ? "PASS" : "FAIL"}`);

    if (!prepared.ok) {
      console.log(`window-fixture-error=${prepared.error || prepared.detail || "unknown"}`);
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
