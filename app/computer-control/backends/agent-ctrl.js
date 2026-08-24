"use strict";

const fs = require("fs");
const {
  AGENT_CTRL,
  exec,
  deterministicPointerClick,
} = require("../../agent-ctrl");


function runtimeInfo() {
  return {
    id:"agent-ctrl",
    path:AGENT_CTRL,
    available:fs.existsSync(AGENT_CTRL),
  };
}

function ensureRuntime() {
  const info = runtimeInfo();

  if (!info.available) {
    return {
      ok:false,
      error:"BACKEND_UNAVAILABLE",
      detail:`agent-ctrl not found: ${info.path}`,
      backend:info,
      state:"FAILED",
      seconds:0,
    };
  }

  const listed = runAction(["list"], "agent-ctrl list");
  let seconds = listed.seconds || 0;

  if (listed.ok && /\bdefault\b/.test(listed.stdout || "")) {
    return {
      ok:true,
      state:"READY",
      backend:info,
      started:false,
      seconds,
      method:"agent-ctrl existing default session",
    };
  }

  const opened = runAction(["open", "ax"], "agent-ctrl open ax");
  seconds += opened.seconds || 0;

  const toleratedAlreadyRunning =
    /already running/i.test(
      String(opened.stderr || "") + String(opened.stdout || "")
    );

  if (!opened.ok && !toleratedAlreadyRunning) {
    return {
      ok:false,
      error:"BACKEND_START_FAILED",
      detail:(opened.stderr || opened.stdout || "could not start AX session").trim(),
      backend:info,
      state:"FAILED",
      seconds,
      method:opened.method,
    };
  }

  return {
    ok:true,
    state:"READY",
    backend:info,
    started:opened.ok,
    seconds,
    method:opened.ok ? opened.method : "agent-ctrl AX session already running",
  };
}

function shutdownRuntime() {
  const info = runtimeInfo();

  if (!info.available) {
    return {
      ok:true,
      state:"STOPPED",
      backend:info,
      seconds:0,
      method:"backend unavailable; nothing to close",
    };
  }

  const closed = runAction(["close"], "agent-ctrl close");
  const toleratedAbsent =
    /no active|not found|no session/i.test(
      String(closed.stderr || "") + String(closed.stdout || "")
    );

  return {
    ok:closed.ok || toleratedAbsent,
    state:closed.ok || toleratedAbsent ? "STOPPED" : "FAILED",
    backend:info,
    seconds:closed.seconds || 0,
    method:closed.method,
    detail:closed.ok || toleratedAbsent
      ? ""
      : (closed.stderr || closed.stdout || "backend close failed").trim(),
  };
}


function switchApplication(provider, identity) {
  const ids = [
    identity?.path,
    identity?.bundle,
    identity?.executable,
    provider?.activation?.application,
    provider?.name,
  ].map(x => String(x || "").trim()).filter(Boolean);

  const unique = [...new Set(ids)];
  let seconds = 0;
  let last = null;

  for (const appId of unique) {
    const r = exec(["switch-app", appId]);
    seconds += r.seconds;
    last = r;

    if (r.code === 0) {
      return {
        ok:true,
        code:0,
        seconds,
        stdout:r.stdout,
        stderr:r.stderr,
        method:`agent-ctrl switch-app ${appId}`,
        appId,
      };
    }
  }

  return {
    ok:false,
    code:last?.code ?? 1,
    seconds,
    stdout:last?.stdout || "",
    stderr:last?.stderr || "no switch-app identity matched",
    method:`agent-ctrl switch-app [${unique.join(" | ")}]`,
    appId:null,
  };
}

function snapshotApplication(provider, identity, settle = true, options = {}) {
  const processNames = [
    identity?.executable,
    provider?.identity?.process,
    provider?.activation?.application,
    provider?.name,
  ].map(x => String(x || "").trim()).filter(Boolean);

  const unique = [...new Set(processNames)];
  let seconds = 0;
  let last = null;

  for (const processName of unique) {
    const args = ["snapshot", "--target-process", processName];
    if (settle) args.push("--settle");
    if (options.compact === false) args.push("--compact", "false");

    const r = exec(args);
    seconds += r.seconds;
    last = r;

    if (r.code === 0 && String(r.stdout || "").trim()) {
      return {
        ok:true,
        code:0,
        seconds,
        stdout:r.stdout,
        stderr:r.stderr,
        method:`agent-ctrl ${args.join(" ")}`,
        processName,
      };
    }
  }

  return {
    ok:false,
    code:last?.code ?? 1,
    seconds,
    stdout:last?.stdout || "",
    stderr:last?.stderr || "no target process produced an AX snapshot",
    method:`agent-ctrl snapshot target candidates=[${unique.join(" | ")}]`,
    processName:null,
  };
}


function runAction(args, method = null) {
  const r = exec(args);
  return {
    ok:r.code === 0,
    code:r.code,
    seconds:r.seconds,
    stdout:r.stdout || "",
    stderr:r.stderr || "",
    method:method || `agent-ctrl ${args.join(" ")}`,
  };
}

function fillElement(ref, text) {
  return runAction(["fill", ref, String(text)], `agent-ctrl fill ${ref}`);
}

function clickElement(ref) {
  return runAction(["click", ref], `agent-ctrl click ${ref}`);
}

function pointerClickElement(ref, app, bounds = null) {
  const r = deterministicPointerClick(ref, app, bounds);
  return {
    ok:r.ok,
    code:r.ok ? 0 : 1,
    seconds:r.seconds || 0,
    stdout:"",
    stderr:r.ok ? "" : (r.summary || "deterministic pointer click failed"),
    method:"deterministic AX-bounds pointer click",
    summary:r.summary || "",
  };
}

function focusElement(ref) {
  return runAction(["focus", ref], `agent-ctrl focus ${ref}`);
}

function getElementProperty(ref, property) {
  const prop = String(property || "").trim();
  return runAction(
    ["get", prop, ref],
    `agent-ctrl get ${prop} ${ref}`
  );
}

function getElementBounds(ref) {
  const r = runAction(
    ["get", "bounds", ref],
    `agent-ctrl get bounds ${ref}`
  );

  if (!r.ok) return {...r, bounds:null};

  try {
    const b = JSON.parse(r.stdout);
    const bounds = {
      x:Number(b.x),
      y:Number(b.y),
      w:Number(b.w),
      h:Number(b.h),
    };

    if (
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.w) ||
      !Number.isFinite(bounds.h)
    ) {
      return {
        ...r,
        ok:false,
        bounds:null,
        stderr:`invalid bounds values: ${r.stdout}`,
      };
    }

    return {...r, bounds};
  } catch (e) {
    return {
      ...r,
      ok:false,
      bounds:null,
      stderr:`invalid bounds JSON: ${e.message}`,
    };
  }
}

function findElement(query, role = null, first = true) {
  const args = ["find", String(query)];
  if (role) args.push("--role", String(role));
  if (first) args.push("--first");

  return runAction(
    args,
    `agent-ctrl ${args.join(" ")}`
  );
}

function getCurrentWindow() {
  const r = runAction(
    ["get", "window", "--json"],
    "agent-ctrl get window --json"
  );

  if (!r.ok) return {...r, window:null};

  try {
    return {
      ...r,
      window:JSON.parse(r.stdout),
    };
  } catch (e) {
    return {
      ...r,
      ok:false,
      code:1,
      window:null,
      stderr:`invalid window JSON: ${e.message}`,
    };
  }
}

function listWindows() {
  const r = runAction(
    ["window-list", "--json"],
    "agent-ctrl window-list --json"
  );

  if (!r.ok) return {...r, windows:[], data:null};

  try {
    const data = JSON.parse(r.stdout);
    const windows = Array.isArray(data?.windows) ? data.windows : null;

    if (!windows) {
      return {
        ...r,
        ok:false,
        code:1,
        windows:[],
        data,
        stderr:"window-list JSON does not contain a windows array",
      };
    }

    return {...r, windows, data};
  } catch (e) {
    return {
      ...r,
      ok:false,
      code:1,
      windows:[],
      data:null,
      stderr:`invalid window-list JSON: ${e.message}`,
    };
  }
}

function focusWindow(windowId) {
  const id = String(windowId || "").trim();

  if (!id) {
    return {
      ok:false,
      code:1,
      seconds:0,
      stdout:"",
      stderr:"window id is required",
      method:"agent-ctrl focus-window",
    };
  }

  return runAction(
    ["focus-window", id, "--json"],
    `agent-ctrl focus-window ${id} --json`
  );
}

function getElementValue(ref) {
  return getElementProperty(ref, "value");
}

function getElementText(ref) {
  return getElementProperty(ref, "text");
}

function pressKeys(keys) {
  return runAction(["press", String(keys)], `agent-ctrl press ${keys}`);
}

function typeText(text) {
  return runAction(["type", String(text)], "agent-ctrl type");
}

function clipboardRead() {
  return runAction(["clipboard", "read"], "agent-ctrl clipboard read");
}

function clipboardWrite(text) {
  return runAction(["clipboard", "write", String(text)], "agent-ctrl clipboard write");
}

function clipboardCopy() {
  return runAction(["clipboard", "copy"], "agent-ctrl clipboard copy");
}

function clipboardPaste() {
  return runAction(["clipboard", "paste"], "agent-ctrl clipboard paste");
}

function waitStable(timeoutMs = 5000, pollMs = 200) {
  return runAction(
    ["wait-for", "--stable", "--timeout", String(timeoutMs), "--poll", String(pollMs)],
    "agent-ctrl wait-for stable"
  );
}

module.exports = {
  runtimeInfo,
  ensureRuntime,
  shutdownRuntime,
  switchApplication,
  snapshotApplication,
  fillElement,
  clickElement,
  pointerClickElement,
  focusElement,
  getCurrentWindow,
  listWindows,
  focusWindow,
  findElement,
  getElementBounds,
  getElementProperty,
  getElementValue,
  getElementText,
  pressKeys,
  typeText,
  clipboardRead,
  clipboardWrite,
  clipboardCopy,
  clipboardPaste,
  waitStable,
};
