"use strict";

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const HELPER_SOURCE = path.resolve(__dirname, "..", "..", "..", "tools", "macos-window-bounds.swift");
const HELPER_BIN = path.resolve(__dirname, "..", "..", "..", "bin", "rumiai-macos-window-bounds");
const DEFAULT_TOLERANCE = 3;

function run(cmd, args) {
  const started = performance.now();
  const result = cp.spawnSync(cmd, args, {encoding:"utf8", maxBuffer:8 * 1024 * 1024});
  return {
    ok:(result.status ?? 1) === 0,
    code:result.status ?? 1,
    stdout:result.stdout || "",
    stderr:result.stderr || "",
    seconds:(performance.now() - started) / 1000,
    method:`${cmd} ${args.join(" ")}`,
  };
}

function ensureHelper() {
  let compile = !fs.existsSync(HELPER_BIN);
  try {
    if (!compile) compile = fs.statSync(HELPER_SOURCE).mtimeMs > fs.statSync(HELPER_BIN).mtimeMs;
  } catch { compile = true; }
  if (!compile) return {ok:true, path:HELPER_BIN, compiled:false, seconds:0};
  const result = run("/usr/bin/xcrun", ["swiftc", HELPER_SOURCE, "-o", HELPER_BIN]);
  if (!result.ok) {
    return {ok:false, error:"WINDOW_BOUNDS_HELPER_COMPILE_FAILED", detail:(result.stderr || result.stdout).trim(), seconds:result.seconds};
  }
  try { fs.chmodSync(HELPER_BIN, 0o755); } catch {}
  return {ok:true, path:HELPER_BIN, compiled:true, seconds:result.seconds};
}

function normalizeBounds(value) {
  if (!value || typeof value !== "object") return null;
  const bounds = {
    x:Number(value.x),
    y:Number(value.y),
    width:Number(value.width),
    height:Number(value.height),
  };
  return Object.values(bounds).every(Number.isFinite) && bounds.width > 0 && bounds.height > 0
    ? bounds
    : null;
}

function boundsEqual(left, right, tolerance = DEFAULT_TOLERANCE) {
  const a = normalizeBounds(left);
  const b = normalizeBounds(right);
  if (!a || !b) return false;
  return ["x", "y", "width", "height"].every(
    key => Math.abs(a[key] - b[key]) <= Number(tolerance)
  );
}

function execute(descriptor = {}, mode = "observe", desired = null) {
  const pid = Number(descriptor.pid || 0);
  const title = descriptor.title == null ? "" : String(descriptor.title);
  if (!Number.isFinite(pid) || pid <= 0) return {ok:false, state:"FAILED", error:"WINDOW_PID_REQUIRED", mode, seconds:0};
  if (!title) return {ok:false, state:"FAILED", error:"WINDOW_TITLE_REQUIRED", mode, seconds:0};
  if (!["observe", "maximize", "set"].includes(mode)) return {ok:false, state:"FAILED", error:"WINDOW_BOUNDS_MODE_INVALID", mode, seconds:0};
  const normalizedDesired = mode === "set" ? normalizeBounds(desired) : null;
  if (mode === "set" && !normalizedDesired) return {ok:false, state:"FAILED", error:"WINDOW_BOUNDS_REQUIRED", mode, seconds:0};

  const helper = ensureHelper();
  if (!helper.ok) return {...helper, state:"FAILED", mode};
  const args = [String(pid), title, mode];
  if (normalizedDesired) args.push(String(normalizedDesired.x), String(normalizedDesired.y), String(normalizedDesired.width), String(normalizedDesired.height));
  const result = run(helper.path, args);
  const raw = String(result.stdout || "").trim();
  let data = null;
  try { data = JSON.parse(raw); } catch (error) {
    return {ok:false, state:"FAILED", error:"WINDOW_BOUNDS_INVALID_JSON", detail:error.message, mode, method:result.method, seconds:helper.seconds + result.seconds};
  }
  if (!result.ok || data?.ok !== true) {
    return {ok:false, state:"FAILED", error:data?.error || "WINDOW_BOUNDS_OPERATION_FAILED", detail:String(result.stderr || raw).trim(), mode, method:data?.method || result.method, seconds:helper.seconds + result.seconds};
  }
  return {
    ok:true,
    state:"OBSERVED",
    pid:Number(data.pid || pid),
    title:String(data.title || title),
    mode,
    before:normalizeBounds(data.before),
    desired:normalizeBounds(data.desired),
    bounds:normalizeBounds(data.after),
    positionSettable:data.positionSettable === true,
    sizeSettable:data.sizeSettable === true,
    method:data.method || result.method,
    compiled:helper.compiled === true,
    seconds:helper.seconds + result.seconds,
  };
}

function observeWindowBounds(descriptor = {}) { return execute(descriptor, "observe"); }
function maximizeWindowBounds(descriptor = {}) { return execute(descriptor, "maximize"); }
function setWindowBounds(descriptor = {}, desired = {}) { return execute(descriptor, "set", desired); }

function sleepSync(ms) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, Math.max(0, Number(ms) || 0));
}

function waitForWindowBounds(descriptor = {}, expected = {}, opts = {}) {
  const started = performance.now();
  const timeoutMs = Number(opts.timeoutMs || 2500);
  const pollMs = Number(opts.pollMs || 50);
  const tolerance = Number(opts.tolerance ?? DEFAULT_TOLERANCE);
  let attempts = 0;
  let last = null;
  let observeSeconds = 0;
  while ((performance.now() - started) <= timeoutMs) {
    last = observeWindowBounds(descriptor);
    attempts += 1;
    observeSeconds += last.seconds || 0;
    if (last.ok && boundsEqual(last.bounds, expected, tolerance)) {
      return {...last, state:"BOUNDS_MATCHED", verified:true, expected:normalizeBounds(expected), tolerance, attempts, observeSeconds, verification:"native-ax-window-bounds"};
    }
    if ((performance.now() - started) >= timeoutMs) break;
    sleepSync(pollMs);
  }
  return {ok:false, state:"UNVERIFIED", error:"WINDOW_BOUNDS_CONDITION_TIMEOUT", expected:normalizeBounds(expected), observed:last?.bounds || null, tolerance, attempts, observeSeconds, verification:"native-ax-window-bounds", seconds:observeSeconds};
}

module.exports = {
  DEFAULT_TOLERANCE,
  ensureHelper,
  normalizeBounds,
  boundsEqual,
  observeWindowBounds,
  maximizeWindowBounds,
  setWindowBounds,
  waitForWindowBounds,
};
