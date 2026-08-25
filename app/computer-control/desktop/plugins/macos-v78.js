"use strict";
const base = require("./macos-v75");
const agentCtrl = require("../../backends/agent-ctrl");
const boundsBackend = require("../../backends/macos-window-bounds");
const {unsupported} = require("../contract");
const platform = "darwin";
function capabilities() { return {...base.capabilities(), "window.move":"IMPLEMENTED"}; }
function normalizeWindow(w = {}) { return {id:String(w?.id || "").trim(), title:w?.title == null ? null : String(w.title), process:String(w?.process || "").trim(), pid:Number(w?.pid || 0)}; }
function complete(w) { return Boolean(w.id && w.title && w.process && Number.isFinite(w.pid) && w.pid > 0); }
function same(a, b) { return Boolean(b && a.title === b.title && a.process === b.process && a.pid === b.pid); }
function moveWindow(application = {}, window = {}, position = {}) {
  let actionSeconds = 0, observeSeconds = 0; const observed = normalizeWindow(window); const x = Number(position?.x), y = Number(position?.y);
  if (!application?.provider || !application?.identity) return unsupported(platform, "moveWindow", "resolved application provider and identity are required");
  if (!observed.id) return {ok:false, state:"FAILED", error:"WINDOW_HANDLE_REQUIRED", verified:false};
  if (!complete(observed)) return {ok:false, state:"FAILED", error:"WINDOW_DESCRIPTOR_INSUFFICIENT", verified:false};
  if (!Number.isFinite(x) || !Number.isFinite(y)) return {ok:false, state:"FAILED", error:"WINDOW_POSITION_REQUIRED", verified:false};
  const established = base.listWindows(application); observeSeconds += established.observeSeconds || established.seconds || 0;
  if (!established.ok) return {ok:false, state:"FAILED", error:established.error || "WINDOW_LIST_FAILED", verified:false};
  const fresh = agentCtrl.listWindows(); observeSeconds += fresh.seconds || 0;
  if (!fresh.ok) return {ok:false, state:"FAILED", error:"WINDOW_LIST_FAILED", verified:false};
  const matches = fresh.windows.map(normalizeWindow).filter(w => same(observed, w));
  if (!matches.length) return {ok:false, state:"FAILED", error:"WINDOW_TARGET_STALE", verified:false};
  if (matches.length !== 1) return {ok:false, state:"FAILED", error:"WINDOW_TARGET_AMBIGUOUS", verified:false};
  const current = matches[0]; const handleRebound = current.id !== observed.id;
  const before = boundsBackend.observeWindowBounds(current); observeSeconds += before.seconds || 0;
  const common = {platform, operation:"moveWindow", window:{title:observed.title, process:observed.process, pid:observed.pid}, observedHandle:observed.id, actionHandle:current.id, handleRebound};
  if (!before.ok || !before.bounds) return {ok:false, state:"FAILED", error:before.error || "WINDOW_BOUNDS_UNAVAILABLE", ...common, verified:false};
  const desired = {x, y, width:before.bounds.width, height:before.bounds.height};
  const action = boundsBackend.setWindowBounds(current, desired); actionSeconds += action.seconds || 0;
  if (!action.ok) return {ok:false, state:"FAILED", error:action.error || "WINDOW_MOVE_ACTION_FAILED", ...common, bounds:before.bounds, desiredBounds:desired, moved:false, method:action.method, verified:false, verification:"native-ax-window-position", actionSeconds, observeSeconds};
  const verified = boundsBackend.waitForWindowBounds(current, desired); observeSeconds += verified.observeSeconds || verified.seconds || 0;
  if (!verified.ok) return {ok:false, state:"UNVERIFIED", error:"WINDOW_MOVE_UNVERIFIED", ...common, bounds:verified.observed, desiredBounds:desired, moved:false, method:action.method, verified:false, verification:"native-ax-window-position", actionSeconds, observeSeconds};
  return {ok:true, state:"MOVED", ...common, bounds:verified.bounds, previousBounds:before.bounds, desiredBounds:desired, position:{x:verified.bounds.x, y:verified.bounds.y}, moved:true, method:action.method, verified:true, verification:"native-ax-window-position", actionSeconds, observeSeconds, seconds:actionSeconds + observeSeconds};
}
module.exports = {...base, id:"macos", platform, capabilities, moveWindow};
