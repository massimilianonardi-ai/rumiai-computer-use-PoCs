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

function normalizeWindow(window) {
  return {
    id:String(window?.id || "").trim(),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || "").trim(),
    pid:Number(window?.pid || 0),
    focused:window?.focused === true,
    pinned:window?.pinned === true,
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

  const windows = listed.windows.map(normalizeWindow);

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

function normalizeFocusDescriptor(window = {}) {
  return {
    id:String(window?.id || "").trim(),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || "").trim(),
    pid:Number(window?.pid || 0),
  };
}

function focusDescriptorComplete(window = {}) {
  return Boolean(
    window.id &&
    window.title !== null &&
    String(window.title).length > 0 &&
    window.process &&
    Number.isFinite(window.pid) &&
    window.pid > 0
  );
}

function sameFocusDescriptor(expected, current) {
  return Boolean(
    current &&
    current.title === expected.title &&
    current.process === expected.process &&
    current.pid === expected.pid
  );
}

function focusWindow(application = {}, window = {}) {
  let actionSeconds = 0;
  let observeSeconds = 0;

  const provider = application?.provider || null;
  const identity = application?.identity || null;
  const observedTarget = normalizeFocusDescriptor(window);

  if (!provider || !identity) {
    return unsupported(
      platform,
      "focusWindow",
      "resolved application provider and identity are required"
    );
  }

  if (!observedTarget.id) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_HANDLE_REQUIRED",
      detail:"focusWindow requires an observed window handle",
      platform,
      operation:"focusWindow",
      method:"window handle validation",
      actionSeconds,
      observeSeconds,
      seconds:0,
    };
  }

  // v64 proved macOS agent-ctrl ids are pid/index action handles that can
  // rebind when AXWindows ordering changes. The old id alone is therefore not
  // sufficient to identify the intended physical window.
  if (!focusDescriptorComplete(observedTarget)) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_DESCRIPTOR_INSUFFICIENT",
      detail:"macOS safe focus requires observed id, title, process and pid",
      platform,
      operation:"focusWindow",
      window:observedTarget,
      method:"window descriptor validation",
      actionSeconds,
      observeSeconds,
      seconds:0,
    };
  }

  // First establish the resolved application's agent-ctrl session context.
  const established = listWindows(application);
  observeSeconds += established.observeSeconds || established.seconds || 0;

  if (!established.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:established.error || "WINDOW_LIST_FAILED",
      detail:established.detail || "could not establish application window context",
      platform,
      operation:"focusWindow",
      window:observedTarget,
      method:established.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  // Read one raw list immediately before the action. This does not perform a
  // new snapshot/pin. Resolve the physical target descriptor to the CURRENT
  // action handle rather than trusting the previously observed pid/index id.
  const fresh = agentCtrl.listWindows();
  observeSeconds += fresh.seconds || 0;

  if (!fresh.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_LIST_FAILED",
      detail:(fresh.stderr || fresh.stdout || "window-list failed before focus").trim(),
      platform,
      operation:"focusWindow",
      window:observedTarget,
      method:fresh.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const currentWindows = fresh.windows.map(normalizeWindow);
  const matches = currentWindows.filter(item =>
    sameFocusDescriptor(observedTarget, item)
  );

  if (matches.length === 0) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_STALE",
      detail:"the observed window descriptor is no longer present",
      platform,
      operation:"focusWindow",
      window:observedTarget,
      method:fresh.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  if (matches.length !== 1) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_AMBIGUOUS",
      detail:`the observed window descriptor matches ${matches.length} current windows`,
      platform,
      operation:"focusWindow",
      window:observedTarget,
      method:fresh.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const currentTarget = matches[0];
  const handleRebound = currentTarget.id !== observedTarget.id;

  const action = agentCtrl.focusWindow(currentTarget.id);
  actionSeconds += action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_FOCUS_ACTION_FAILED",
      detail:(action.stderr || action.stdout || "focus-window failed").trim(),
      platform,
      operation:"focusWindow",
      window:{
        title:observedTarget.title,
        process:observedTarget.process,
        pid:observedTarget.pid,
      },
      observedHandle:observedTarget.id,
      actionHandle:currentTarget.id,
      handleRebound,
      method:action.method,
      verified:false,
      verification:"native-focused-window-descriptor",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  // v65 validated this native observer against an independent physical
  // TextEdit front-document observation. It is independent of agent-ctrl's
  // positional pin and therefore remains valid even when pid/index ids rebind.
  const verified = macosNative.waitForFocusedWindow({
    pid:observedTarget.pid,
    process:observedTarget.process,
    title:observedTarget.title,
    bundle:identity.bundle || "",
  });
  observeSeconds += verified.observeSeconds || verified.seconds || 0;

  if (!verified.ok) {
    return {
      ok:false,
      state:"UNVERIFIED",
      error:"WINDOW_FOCUS_UNVERIFIED",
      detail:verified.detail || "native focused window did not match target descriptor",
      platform,
      operation:"focusWindow",
      window:{
        title:observedTarget.title,
        process:observedTarget.process,
        pid:observedTarget.pid,
      },
      observedHandle:observedTarget.id,
      actionHandle:currentTarget.id,
      handleRebound,
      nativeWindow:verified.observed || null,
      method:action.method,
      verified:false,
      verification:"native-focused-window-descriptor",
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
    window:{
      title:observedTarget.title,
      process:observedTarget.process,
      pid:observedTarget.pid,
    },
    observedHandle:observedTarget.id,
    actionHandle:currentTarget.id,
    handleRebound,
    nativeWindow:{
      title:verified.title,
      process:verified.process,
      pid:verified.pid,
      bundle:verified.bundle,
      identifier:verified.identifier,
      windowNumber:verified.windowNumber,
    },
    method:action.method,
    verified:true,
    verification:"native-focused-window-descriptor",
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
