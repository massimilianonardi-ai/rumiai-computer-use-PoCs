"use strict";

const base = require("./macos-v80");
const macosNative = require("../../backends/macos-native");
const {unsupported} = require("../contract");

const platform = "darwin";

function normalizeWindow(window = {}) {
  return {
    id:String(window?.id || "").trim(),
    title:window?.title == null ? null : String(window.title),
    process:String(window?.process || "").trim(),
    pid:Number(window?.pid || 0),
    focused:window?.focused === true,
    pinned:window?.pinned === true,
  };
}

function sameDescriptor(observed, current) {
  return Boolean(
    current &&
    current.title === observed.title &&
    current.process === observed.process &&
    current.pid === observed.pid
  );
}

function getCurrentWindow(application = {}) {
  let observeSeconds = 0;
  const identity = application?.identity || null;

  if (!application?.provider || !identity) {
    return unsupported(
      platform,
      "getCurrentWindow",
      "resolved application provider and identity are required"
    );
  }

  // Establish the resolved process and obtain complete, observation-scoped
  // descriptors. The agent-ctrl positional pin is not current-window proof.
  const listed = base.listWindows(application);
  observeSeconds += listed.observeSeconds || listed.seconds || 0;

  if (!listed.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:listed.error || "WINDOW_LIST_FAILED",
      detail:listed.detail || "could not establish application window context",
      platform,
      operation:"getCurrentWindow",
      window:null,
      method:listed.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  // Use the v65 native observer as the source of truth. It reports the actual
  // focused AX window and is independent of agent-ctrl's pid/index pin.
  const native = macosNative.focusedWindowObservation();
  observeSeconds += native.seconds || 0;

  if (!native.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_OBSERVATION_FAILED",
      detail:native.detail || "native focused window unavailable",
      platform,
      operation:"getCurrentWindow",
      window:null,
      method:native.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  const expectedBundle = String(identity.bundle || "").trim().toLowerCase();
  const observedBundle = String(native.bundle || "").trim().toLowerCase();
  if (expectedBundle && observedBundle !== expectedBundle) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_MISMATCH",
      detail:"the physically focused window does not belong to the resolved application",
      platform,
      operation:"getCurrentWindow",
      window:null,
      method:native.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  const observed = normalizeWindow(native);
  const matches = listed.windows
    .map(normalizeWindow)
    .filter(window => sameDescriptor(observed, window));

  if (matches.length === 0) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_STALE",
      detail:"the native focused-window descriptor is not present in the fresh window list",
      platform,
      operation:"getCurrentWindow",
      window:null,
      method:native.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  if (matches.length !== 1) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TARGET_AMBIGUOUS",
      detail:`the native focused-window descriptor matches ${matches.length} windows`,
      platform,
      operation:"getCurrentWindow",
      window:null,
      method:native.method,
      observeSeconds,
      seconds:observeSeconds,
    };
  }

  const current = matches[0];
  return {
    ok:true,
    state:"OBSERVED",
    platform,
    operation:"getCurrentWindow",
    window:{field:"window", value:current},
    nativeWindow:{
      title:native.title,
      process:native.process,
      pid:native.pid,
      bundle:native.bundle,
      identifier:native.identifier,
      windowNumber:native.windowNumber,
    },
    method:native.method,
    verification:"native-focused-window-descriptor",
    observeSeconds,
    seconds:observeSeconds,
  };
}

module.exports = {
  ...base,
  id:"macos",
  platform,
  getCurrentWindow,
};
