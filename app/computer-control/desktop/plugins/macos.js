"use strict";

const agentCtrl = require("../../backends/agent-ctrl");
const macosNative = require("../../backends/macos-native");
const {unsupported} = require("../contract");

const platform = "darwin";

const CAPABILITIES = Object.freeze({
  "application.find":"DEFERRED",
  "application.resolve":"IMPLEMENTED",
  "application.launch":"IMPLEMENTED",
  "application.activate":"IMPLEMENTED",
  "application.foreground":"IMPLEMENTED",
  "system-settings.resolve":"IMPLEMENTED",
  "window.list":"IMPLEMENTED",
  "window.current":"IMPLEMENTED",
  "window.focus":"IMPLEMENTED",
  "window.close":"IMPLEMENTED",
  "window.minimize":"DEFERRED",
  "window.maximize":"DEFERRED",
  "window.restore":"DEFERRED",
  "window.move":"DEFERRED",
  "window.resize":"DEFERRED",
});

function capabilities() {
  return {...CAPABILITIES};
}

function findApplications() {
  return unsupported(platform, "findApplications");
}

function resolveApplication({provider, exactPath} = {}) {
  if (!provider) {
    return unsupported(platform, "resolveApplication", "provider is required");
  }

  return {
    ok:true,
    state:"RESOLVED",
    platform,
    provider,
    identity:macosNative.resolveApplicationIdentity(provider, exactPath),
  };
}

function launchApplication(application = {}) {
  const exactPath =
    application?.identity?.path ||
    application?.exactPath ||
    application?.path ||
    null;

  return macosNative.launchApplicationBundle(exactPath);
}

function activateApplication(application = {}) {
  const provider = application?.provider || null;
  const identity = application?.identity || null;

  if (!provider) {
    return unsupported(platform, "activateApplication", "provider is required");
  }

  return agentCtrl.switchApplication(provider, identity);
}

function getForegroundApplication() {
  return macosNative.foregroundApplication();
}

function getSystemSettingsApplication() {
  return {
    ok:true,
    state:"RESOLVED",
    platform,
    name:"System Settings",
    aliases:["System Preferences", "Impostazioni di Sistema", "Preferenze di Sistema"],
  };
}

function listWindows(application = {}) {
  const provider = application?.provider || null;
  const identity = application?.identity || null;

  if (!provider || !identity) {
    return unsupported(
      platform,
      "listWindows",
      "resolved application provider and identity are required"
    );
  }

  // agent-ctrl window-list enumerates windows for the session's pinned process.
  // Pin explicitly through a fresh read-only snapshot so listWindows() never
  // depends on whichever application happened to be observed previously.
  const pinned = agentCtrl.snapshotApplication(
    provider,
    identity,
    false,
    {compact:true}
  );

  if (!pinned.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_LIST_PIN_FAILED",
      detail:(pinned.stderr || pinned.stdout || "could not pin application window").trim(),
      platform,
      operation:"listWindows",
      windows:[],
      method:pinned.method,
      observeSeconds:pinned.seconds || 0,
      seconds:pinned.seconds || 0,
    };
  }

  const listed = agentCtrl.listWindows();
  const observeSeconds = (pinned.seconds || 0) + (listed.seconds || 0);

  if (!listed.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_LIST_FAILED",
      detail:(listed.stderr || listed.stdout || "window-list failed").trim(),
      platform,
      operation:"listWindows",
      windows:[],
      method:listed.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  const windows = listed.windows.map(window => ({
    id:String(window?.id || ""),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || ""),
    pid:Number(window?.pid || 0),
    focused:window?.focused === true,
    pinned:window?.pinned === true,
  }));

  return {
    ok:true,
    state:"OBSERVED",
    platform,
    operation:"listWindows",
    windows,
    method:listed.method,
    observeSeconds,
    seconds:observeSeconds,
  };
}

function getCurrentWindow() {
  return agentCtrl.getCurrentWindow();
}

function focusWindow(application = {}, window = {}) {
  let actionSeconds = 0;
  let observeSeconds = 0;

  const provider = application?.provider || null;
  const identity = application?.identity || null;
  const targetId = String(window?.id || "").trim();

  if (!provider || !identity) {
    return unsupported(
      platform,
      "focusWindow",
      "resolved application provider and identity are required"
    );
  }

  if (!targetId) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_ID_REQUIRED",
      detail:"focusWindow requires a stable window id",
      platform,
      operation:"focusWindow",
      method:"window id validation",
      actionSeconds,
      observeSeconds,
      seconds:0,
    };
  }

  // Establish the application's current window set and prove the target id
  // belongs to it. This initial observation may pin one app window; after the
  // focus action no snapshot is allowed before verification because a targeted
  // snapshot could overwrite the session pin we are trying to verify.
  const before = listWindows(application);
  observeSeconds += before.observeSeconds || before.seconds || 0;

  if (!before.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:before.error || "WINDOW_LIST_FAILED",
      detail:before.detail || "could not observe application windows before focus",
      platform,
      operation:"focusWindow",
      window:{id:targetId},
      method:before.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const targetBefore = before.windows.find(item => item.id === targetId) || null;
  if (!targetBefore) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_NOT_FOUND",
      detail:`window ${targetId} is not owned by the resolved application`,
      platform,
      operation:"focusWindow",
      window:{id:targetId},
      method:before.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const action = agentCtrl.focusWindow(targetId);
  actionSeconds += action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_FOCUS_ACTION_FAILED",
      detail:(action.stderr || action.stdout || "focus-window failed").trim(),
      platform,
      operation:"focusWindow",
      window:targetBefore,
      method:action.method,
      verified:false,
      verification:"window-list-target-pinned",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  // Read the session window state directly. Do NOT call plugin listWindows()
  // here: it deliberately snapshots by process and could re-pin a different
  // window, destroying the postcondition we need to observe.
  const after = agentCtrl.listWindows();
  observeSeconds += after.seconds || 0;

  if (!after.ok) {
    return {
      ok:false,
      state:"UNVERIFIED",
      error:"WINDOW_FOCUS_VERIFICATION_FAILED",
      detail:(after.stderr || after.stdout || "window-list unavailable after focus").trim(),
      platform,
      operation:"focusWindow",
      window:targetBefore,
      method:action.method,
      verified:false,
      verification:"window-list-target-pinned",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const targetAfterRaw = after.windows.find(
    item => String(item?.id || "") === targetId
  ) || null;

  const targetAfter = targetAfterRaw ? {
    id:String(targetAfterRaw.id || ""),
    title:targetAfterRaw.title == null ? null : String(targetAfterRaw.title),
    process:String(targetAfterRaw.process || ""),
    pid:Number(targetAfterRaw.pid || 0),
    focused:targetAfterRaw.focused === true,
    pinned:targetAfterRaw.pinned === true,
  } : null;

  const verified = Boolean(targetAfter && targetAfter.pinned === true);

  if (!verified) {
    return {
      ok:false,
      state:"UNVERIFIED",
      error:"WINDOW_FOCUS_UNVERIFIED",
      detail:"focus action completed but target window is not pinned afterwards",
      platform,
      operation:"focusWindow",
      window:targetAfter || targetBefore,
      method:action.method,
      verified:false,
      verification:"window-list-target-pinned",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  return {
    ok:true,
    state:"FOCUSED",
    platform,
    operation:"focusWindow",
    window:targetAfter,
    method:action.method,
    verified:true,
    verification:"window-list-target-pinned",
    actionSeconds,
    observeSeconds,
    seconds:actionSeconds + observeSeconds,
  };
}

function windowId(window) {
  if (!window) return null;
  const value = window?.value || window;
  return value?.id || window?.id || null;
}

function snapshotWindowId(snapshot) {
  const match = String(snapshot || "").match(/^# window:\s+(.+?)\s+-/m);
  return match ? match[1].trim() : null;
}

function closeWindow(application = {}) {
  let actionSeconds = 0;
  let observeSeconds = 0;

  const provider = application?.provider || null;
  const identity = application?.identity || null;

  if (!provider || !identity) {
    return unsupported(
      platform,
      "closeWindow",
      "resolved application provider and identity are required"
    );
  }

  const before = agentCtrl.getCurrentWindow();
  observeSeconds += before.seconds || 0;

  if (!before.ok || !before.window) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_OBSERVATION_FAILED",
      detail:(before.stderr || before.stdout || "current window unavailable before close").trim(),
      platform,
      operation:"closeWindow",
      method:before.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const beforeId = windowId(before.window);
  if (!beforeId) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_ID_UNAVAILABLE",
      detail:"current window has no stable id before close",
      platform,
      operation:"closeWindow",
      window:before.window,
      method:before.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const action = agentCtrl.pressKeys("Cmd+W");
  actionSeconds += action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_CLOSE_ACTION_FAILED",
      detail:(action.stderr || action.stdout || "Cmd+W failed").trim(),
      platform,
      operation:"closeWindow",
      window:before.window,
      method:action.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const stable = agentCtrl.waitStable(3000, 100);
  observeSeconds += stable.seconds || 0;

  // v59 diagnostic result: agent-ctrl get window may remain stale after a
  // physically successful close. A fresh AX application snapshot is the
  // authoritative postcondition. If no snapshot exists, the app has no
  // observable window. If another window exists, its AX window id must differ
  // from the pre-close id.
  const afterSnapshot = agentCtrl.snapshotApplication(
    provider,
    identity,
    false,
    {compact:true}
  );
  observeSeconds += afterSnapshot.seconds || 0;

  const afterId = afterSnapshot.ok
    ? snapshotWindowId(afterSnapshot.stdout)
    : null;

  const verified =
    !afterSnapshot.ok ||
    (afterId !== null && afterId !== beforeId);

  if (!verified) {
    return {
      ok:false,
      state:"UNVERIFIED",
      error:"WINDOW_CLOSE_UNVERIFIED",
      detail:"close action delivered but the same AX window is still observed",
      platform,
      operation:"closeWindow",
      window:before.window,
      currentWindow:afterId ? {id:afterId} : null,
      method:action.method,
      verified:false,
      verification:"ax-window-absent-or-changed",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  return {
    ok:true,
    state:"CLOSED",
    platform,
    operation:"closeWindow",
    window:before.window,
    currentWindow:afterId ? {id:afterId} : null,
    method:action.method,
    verified:true,
    verification:"ax-window-absent-or-changed",
    actionSeconds,
    observeSeconds,
    seconds:actionSeconds + observeSeconds,
  };
}

function minimizeWindow() {
  return unsupported(platform, "minimizeWindow");
}

function maximizeWindow() {
  return unsupported(platform, "maximizeWindow");
}

function restoreWindow() {
  return unsupported(platform, "restoreWindow");
}

function moveWindow() {
  return unsupported(platform, "moveWindow");
}

function resizeWindow() {
  return unsupported(platform, "resizeWindow");
}

module.exports = {
  id:"macos",
  platform,
  capabilities,
  findApplications,
  resolveApplication,
  launchApplication,
  activateApplication,
  getForegroundApplication,
  getSystemSettingsApplication,
  listWindows,
  getCurrentWindow,
  focusWindow,
  closeWindow,
  minimizeWindow,
  maximizeWindow,
  restoreWindow,
  moveWindow,
  resizeWindow,
};
