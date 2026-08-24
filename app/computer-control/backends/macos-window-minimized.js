"use strict";

const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const HELPER_SOURCE = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "tools",
  "macos-window-minimized.swift"
);

const HELPER_BIN = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "bin",
  "rumiai-macos-window-minimized"
);

function run(cmd, args) {
  const started = performance.now();
  const result = cp.spawnSync(cmd, args, {
    encoding:"utf8",
    maxBuffer:8 * 1024 * 1024,
  });

  return {
    ok:(result.status ?? 1) === 0,
    code:result.status ?? 1,
    stdout:result.stdout || "",
    stderr:result.stderr || "",
    seconds:(performance.now() - started) / 1000,
    method:`${cmd} ${args.join(" ")}`,
  };
}

function helperNeedsCompile() {
  if (!fs.existsSync(HELPER_BIN)) return true;

  try {
    return fs.statSync(HELPER_SOURCE).mtimeMs > fs.statSync(HELPER_BIN).mtimeMs;
  } catch {
    return true;
  }
}

function ensureHelper() {
  if (!helperNeedsCompile()) {
    return {ok:true, path:HELPER_BIN, compiled:false, seconds:0};
  }

  const which = run("/usr/bin/xcrun", ["--find", "swiftc"]);
  if (!which.ok) {
    return {
      ok:false,
      error:"SWIFTC_UNAVAILABLE",
      detail:(which.stderr || which.stdout || "swiftc unavailable").trim(),
      seconds:which.seconds || 0,
    };
  }

  const compiled = run("/usr/bin/xcrun", [
    "swiftc",
    HELPER_SOURCE,
    "-o",
    HELPER_BIN,
  ]);

  if (!compiled.ok) {
    return {
      ok:false,
      error:"WINDOW_MINIMIZED_HELPER_COMPILE_FAILED",
      detail:(compiled.stderr || compiled.stdout || "helper compile failed").trim(),
      seconds:(which.seconds || 0) + (compiled.seconds || 0),
    };
  }

  try { fs.chmodSync(HELPER_BIN, 0o755); } catch {}

  return {
    ok:true,
    path:HELPER_BIN,
    compiled:true,
    seconds:(which.seconds || 0) + (compiled.seconds || 0),
  };
}

function parseHelperResult(executed, helper, mode) {
  const seconds = (helper.seconds || 0) + (executed.seconds || 0);
  const raw = String(executed.stdout || "").trim();

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_MINIMIZED_INVALID_JSON",
      detail:`invalid minimized-window JSON: ${error.message}`,
      method:executed.method,
      seconds,
    };
  }

  if (!executed.ok || data?.ok !== true) {
    return {
      ok:false,
      state:"FAILED",
      error:data?.error || "WINDOW_MINIMIZED_OPERATION_FAILED",
      detail:String(executed.stderr || raw || "minimized-window operation failed").trim(),
      pid:Number(data?.pid || 0),
      title:data?.title == null ? null : String(data.title),
      mode,
      matchCount:Number(data?.matchCount || 0),
      minimizedBefore:data?.minimizedBefore == null ? null : data.minimizedBefore === true,
      minimizedAfter:data?.minimizedAfter == null ? null : data.minimizedAfter === true,
      settable:data?.settable === true,
      axError:data?.axError ?? data?.settableAxError ?? null,
      method:data?.method || executed.method,
      compiled:helper.compiled === true,
      seconds,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    pid:Number(data.pid || 0),
    title:data.title == null ? null : String(data.title),
    mode:String(data.mode || mode),
    matchCount:Number(data.matchCount || 0),
    minimizedBefore:data.minimizedBefore == null ? null : data.minimizedBefore === true,
    minimizedAfter:data.minimizedAfter == null ? null : data.minimizedAfter === true,
    settable:data.settable === true,
    settableAxError:data.settableAxError ?? null,
    method:data.method || executed.method,
    compiled:helper.compiled === true,
    seconds,
  };
}

function execute({pid, title, mode}) {
  const normalizedPid = Number(pid || 0);
  const normalizedTitle = title == null ? "" : String(title);

  if (!Number.isFinite(normalizedPid) || normalizedPid <= 0) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_PID_REQUIRED",
      detail:"positive window pid is required",
      mode,
      seconds:0,
    };
  }

  if (!normalizedTitle) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_TITLE_REQUIRED",
      detail:"exact window title is required",
      mode,
      seconds:0,
    };
  }

  if (!["observe", "minimize", "restore"].includes(mode)) {
    return {
      ok:false,
      state:"FAILED",
      error:"WINDOW_MINIMIZED_MODE_INVALID",
      detail:`unsupported minimized-window mode: ${mode}`,
      mode,
      seconds:0,
    };
  }

  const helper = ensureHelper();
  if (!helper.ok) {
    return {
      ok:false,
      state:"FAILED",
      error:helper.error,
      detail:helper.detail,
      mode,
      seconds:helper.seconds || 0,
    };
  }

  const executed = run(helper.path, [
    String(normalizedPid),
    normalizedTitle,
    mode,
  ]);

  return parseHelperResult(executed, helper, mode);
}

function observeWindowMinimized(descriptor = {}) {
  return execute({
    pid:descriptor.pid,
    title:descriptor.title,
    mode:"observe",
  });
}

function setWindowMinimized(descriptor = {}, minimized = true) {
  return execute({
    pid:descriptor.pid,
    title:descriptor.title,
    mode:minimized ? "minimize" : "restore",
  });
}

function sleepSync(ms) {
  const timeout = Math.max(0, Number(ms) || 0);
  if (!timeout) return;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, timeout);
}

function waitForWindowMinimized(descriptor = {}, expected = true, opts = {}) {
  const started = performance.now();
  const timeoutMs = Number(opts.timeoutMs || 2000);
  const pollMs = Number(opts.pollMs || 50);
  let attempts = 0;
  let observeSeconds = 0;
  let last = null;

  while ((performance.now() - started) <= timeoutMs) {
    last = observeWindowMinimized(descriptor);
    attempts += 1;
    observeSeconds += last.seconds || 0;

    if (last.ok && last.minimizedAfter === Boolean(expected)) {
      return {
        ...last,
        state:expected ? "MINIMIZED" : "RESTORED",
        minimized:Boolean(expected),
        attempts,
        observeSeconds,
        waitSeconds:(performance.now() - started) / 1000,
        verification:expected
          ? "native-ax-minimized-true"
          : "native-ax-minimized-false",
      };
    }

    if ((performance.now() - started) >= timeoutMs) break;
    sleepSync(pollMs);
  }

  return {
    ok:false,
    state:"UNVERIFIED",
    error:"WINDOW_MINIMIZED_CONDITION_TIMEOUT",
    detail:`AXMinimized did not become ${Boolean(expected)} within ${timeoutMs}ms`,
    expected:Boolean(expected),
    observed:last?.ok ? last.minimizedAfter : null,
    attempts,
    observeSeconds,
    waitSeconds:(performance.now() - started) / 1000,
    verification:expected
      ? "native-ax-minimized-true"
      : "native-ax-minimized-false",
    method:last?.method || "macOS AXMinimized helper",
    seconds:observeSeconds,
  };
}

module.exports = {
  ensureHelper,
  observeWindowMinimized,
  setWindowMinimized,
  waitForWindowMinimized,
};
