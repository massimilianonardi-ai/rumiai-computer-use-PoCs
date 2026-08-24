"use strict";

const base = require("./macos-v70");
const agentCtrl = require("../../backends/agent-ctrl");
const macosWindowMinimized = require("../../backends/macos-window-minimized");
const {unsupported} = require("../contract");

const platform = "darwin";

function capabilities() {
  return {
    ...base.capabilities(),
    "window.restore":"IMPLEMENTED",
  };
}

function normalizeWindow(window = {}) {
  return {
    id:String(window?.id || "").trim(),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || "").trim(),
    pid:Number(window?.pid || 0),
  };
}

function descriptorComplete(window = {}) {
  return Boolean(
    window.id &&
    window.title !== null &&
    String(window.title).length > 0 &&
    window.process &&
    Number.isFinite(window.pid) &&
    window.pid > 0
  );
}

function sameDescriptor(expected, current) {
  return Boolean(
    current &&
    current.title === expected.title &&
    current.process === expected.process &&
    current.pid === expected.pid
  );
}

function restoreWindow(application = {}, window = {}) {
  let actionSeconds = 0;
  let observeSeconds = 0;

  const provider = application?.provider || null;
  const identity = application?.identity || null;
  const observedTarget = normalizeWindow(window);

  if (!provider || !identity) {
    return unsupported(
      platform,
      "restoreWindow",
      "resolved application provider and identity are required"
    );
  }

  if (!observedTarget.id) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_HANDLE_REQUIRED",
      detail:"restoreWindow requires an observed window handle",
      platform,
      operation:"restoreWindow",
      method:"window handle validation",
      actionSeconds,
      observeSeconds,
      seconds:0,
    };
  }

  if (!descriptorComplete(observedTarget)) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_DESCRIPTOR_INSUFFICIENT",
      detail:"macOS safe restore requires observed id, title, process and pid",
      platform,
      operation:"restoreWindow",
      window:observedTarget,
      method:"window descriptor validation",
      actionSeconds,
      observeSeconds,
      seconds:0,
    };
  }

  const established = base.listWindows(application);
  observeSeconds += established.observeSeconds || established.seconds || 0;

  if (!established.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:established.error || "WINDOW_LIST_FAILED",
      detail:established.detail || "could not establish application window context",
      platform,
      operation:"restoreWindow",
      window:observedTarget,
      method:established.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  // v64/v66 rule: the observed pid/index id is an ephemeral handle. Resolve
  // the physical descriptor again immediately before the restore mutation.
  const fresh = agentCtrl.listWindows();
  observeSeconds += fresh.seconds || 0;

  if (!fresh.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_LIST_FAILED",
      detail:(fresh.stderr || fresh.stdout || "window-list failed before restore").trim(),
      platform,
      operation:"restoreWindow",
      window:observedTarget,
      method:fresh.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const currentWindows = fresh.windows.map(normalizeWindow);
  const matches = currentWindows.filter(item => sameDescriptor(observedTarget, item));

  if (matches.length === 0) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_STALE",
      detail:"the observed window descriptor is no longer present",
      platform,
      operation:"restoreWindow",
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
      operation:"restoreWindow",
      window:observedTarget,
      method:fresh.method,
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const currentTarget = matches[0];
  const handleRebound = currentTarget.id !== observedTarget.id;
  const before = macosWindowMinimized.observeWindowMinimized(currentTarget);
  observeSeconds += before.seconds || 0;

  if (!before.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:before.error || "WINDOW_RESTORE_PRECONDITION_FAILED",
      detail:before.detail || "native AXMinimized precondition unavailable",
      platform,
      operation:"restoreWindow",
      window:{
        title:observedTarget.title,
        process:observedTarget.process,
        pid:observedTarget.pid,
      },
      observedHandle:observedTarget.id,
      actionHandle:currentTarget.id,
      handleRebound,
      minimized:before.minimizedAfter,
      method:before.method,
      verified:false,
      verification:"native-ax-minimized-false",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  if (before.minimizedAfter !== true) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_NOT_MINIMIZED",
      detail:"restoreWindow requires native AXMinimized=true before action",
      platform,
      operation:"restoreWindow",
      window:{
        title:observedTarget.title,
        process:observedTarget.process,
        pid:observedTarget.pid,
      },
      observedHandle:observedTarget.id,
      actionHandle:currentTarget.id,
      handleRebound,
      minimized:false,
      method:before.method,
      verified:false,
      verification:"native-ax-minimized-false",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  const action = macosWindowMinimized.setWindowMinimized(
    currentTarget,
    false
  );
  actionSeconds += action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:action.error || "WINDOW_RESTORE_ACTION_FAILED",
      detail:action.detail || "native AXMinimized mutation failed",
      platform,
      operation:"restoreWindow",
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
      verification:"native-ax-minimized-false",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  // v69 proved immediate AX readback can be stale. Require state-driven
  // re-observation of AXMinimized=false after the mutation succeeds.
  const verified = macosWindowMinimized.waitForWindowMinimized(
    currentTarget,
    false
  );
  observeSeconds += verified.observeSeconds || verified.seconds || 0;

  if (!verified.ok) {
    return {
      ok:false,
      state:"UNVERIFIED",
      error:"WINDOW_RESTORE_UNVERIFIED",
      detail:verified.detail || "AXMinimized did not become false",
      platform,
      operation:"restoreWindow",
      window:{
        title:observedTarget.title,
        process:observedTarget.process,
        pid:observedTarget.pid,
      },
      observedHandle:observedTarget.id,
      actionHandle:currentTarget.id,
      handleRebound,
      minimized:verified.observed,
      restored:false,
      method:action.method,
      verified:false,
      verification:"native-ax-minimized-false",
      actionSeconds,
      observeSeconds,
      seconds:actionSeconds + observeSeconds,
    };
  }

  return {
    ok:true,
    state:"RESTORED",
    platform,
    operation:"restoreWindow",
    window:{
      title:observedTarget.title,
      process:observedTarget.process,
      pid:observedTarget.pid,
    },
    observedHandle:observedTarget.id,
    actionHandle:currentTarget.id,
    handleRebound,
    minimized:false,
    restored:true,
    method:action.method,
    verified:true,
    verification:"native-ax-minimized-false",
    actionSeconds,
    observeSeconds,
    seconds:actionSeconds + observeSeconds,
  };
}

module.exports = {
  ...base,
  id:"macos",
  platform,
  capabilities,
  restoreWindow,
};
