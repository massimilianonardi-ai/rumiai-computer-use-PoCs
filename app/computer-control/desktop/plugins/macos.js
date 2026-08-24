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
  "window.list":"DEFERRED",
  "window.current":"IMPLEMENTED",
  "window.focus":"DEFERRED",
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

function listWindows() {
  return unsupported(platform, "listWindows");
}

function getCurrentWindow() {
  return agentCtrl.getCurrentWindow();
}

function focusWindow() {
  return unsupported(platform, "focusWindow");
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
