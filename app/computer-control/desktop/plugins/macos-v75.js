"use strict";

const base = require("./macos-v72");
const agentCtrl = require("../../backends/agent-ctrl");
const macosWindowBounds = require("../../backends/macos-window-bounds");
const {unsupported} = require("../contract");

const platform = "darwin";

function capabilities() {
  return {...base.capabilities(), "window.maximize":"IMPLEMENTED"};
}

function normalizeWindow(window = {}) {
  return {id:String(window?.id || "").trim(), title:window?.title == null ? null : String(window.title), process:String(window?.process || "").trim(), pid:Number(window?.pid || 0)};
}

function complete(window) {
  return Boolean(window.id && window.title && window.process && Number.isFinite(window.pid) && window.pid > 0);
}

function sameDescriptor(expected, current) {
  return Boolean(current && current.title === expected.title && current.process === expected.process && current.pid === expected.pid);
}

function maximizeWindow(application = {}, window = {}) {
  let actionSeconds = 0;
  let observeSeconds = 0;
  const observedTarget = normalizeWindow(window);
  if (!application?.provider || !application?.identity) return unsupported(platform, "maximizeWindow", "resolved application provider and identity are required");
  if (!observedTarget.id) return {ok:false, state:"FAILED", error:"WINDOW_HANDLE_REQUIRED", platform, operation:"maximizeWindow", verified:false, seconds:0};
  if (!complete(observedTarget)) return {ok:false, state:"FAILED", error:"WINDOW_DESCRIPTOR_INSUFFICIENT", platform, operation:"maximizeWindow", window:observedTarget, verified:false, seconds:0};

  const established = base.listWindows(application);
  observeSeconds += established.observeSeconds || established.seconds || 0;
  if (!established.ok) return {ok:false, state:"FAILED", error:established.error || "WINDOW_LIST_FAILED", detail:established.detail, platform, operation:"maximizeWindow", verified:false, actionSeconds, observeSeconds, seconds:actionSeconds + observeSeconds};
  const fresh = agentCtrl.listWindows();
  observeSeconds += fresh.seconds || 0;
  if (!fresh.ok) return {ok:false, state:"FAILED", error:"WINDOW_LIST_FAILED", platform, operation:"maximizeWindow", verified:false, actionSeconds, observeSeconds, seconds:actionSeconds + observeSeconds};
  const matches = fresh.windows.map(normalizeWindow).filter(item => sameDescriptor(observedTarget, item));
  if (matches.length === 0) return {ok:false, state:"FAILED", error:"WINDOW_TARGET_STALE", platform, operation:"maximizeWindow", window:observedTarget, verified:false, actionSeconds, observeSeconds, seconds:actionSeconds + observeSeconds};
  if (matches.length !== 1) return {ok:false, state:"FAILED", error:"WINDOW_TARGET_AMBIGUOUS", detail:`descriptor matches ${matches.length} windows`, platform, operation:"maximizeWindow", window:observedTarget, verified:false, actionSeconds, observeSeconds, seconds:actionSeconds + observeSeconds};

  const currentTarget = matches[0];
  const handleRebound = currentTarget.id !== observedTarget.id;
  const action = macosWindowBounds.maximizeWindowBounds(currentTarget);
  actionSeconds += action.seconds || 0;
  const common = {platform, operation:"maximizeWindow", window:{title:observedTarget.title, process:observedTarget.process, pid:observedTarget.pid}, observedHandle:observedTarget.id, actionHandle:currentTarget.id, handleRebound, actionSeconds};
  if (!action.ok || !action.desired) return {ok:false, state:"FAILED", error:action.error || "WINDOW_MAXIMIZE_ACTION_FAILED", detail:action.detail, ...common, method:action.method, verified:false, verification:"native-ax-visible-frame-bounds", observeSeconds, seconds:actionSeconds + observeSeconds};
  const verified = macosWindowBounds.waitForWindowBounds(currentTarget, action.desired);
  observeSeconds += verified.observeSeconds || verified.seconds || 0;
  if (!verified.ok) return {ok:false, state:"UNVERIFIED", error:"WINDOW_MAXIMIZE_UNVERIFIED", ...common, bounds:verified.observed, desiredBounds:action.desired, maximized:false, method:action.method, verified:false, verification:"native-ax-visible-frame-bounds", observeSeconds, seconds:actionSeconds + observeSeconds};
  return {ok:true, state:"MAXIMIZED", ...common, bounds:verified.bounds, desiredBounds:action.desired, maximized:true, method:action.method, verified:true, verification:"native-ax-visible-frame-bounds", observeSeconds, seconds:actionSeconds + observeSeconds};
}

module.exports = {...base, id:"macos", platform, capabilities, maximizeWindow};
