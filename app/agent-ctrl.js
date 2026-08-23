"use strict";

const cp = require("child_process");
const path = require("path");
const { applicationSpec } = require("./provider-manager");

const ROOT = path.resolve(__dirname, "..");
const AGENT_CTRL = process.env.AGENT_CTRL || path.join(ROOT, "bin", "agent-ctrl");

function exec(args, opts = {}) {
  const started = performance.now();
  const result = cp.spawnSync(AGENT_CTRL, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  const seconds = (performance.now() - started) / 1000;
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    seconds,
  };
}

function activateApp(requestedApp) {
  const started = performance.now();
  const spec = applicationSpec(requestedApp);
  const app = spec.process;

  if (!app) {
    return {
      code: 1,
      method: "invalid app",
      app: null,
      stdout: "",
      stderr: "empty application name",
      seconds: 0,
    };
  }

  // Prefer bundle id on macOS when known: agent-ctrl switch-app explicitly
  // supports bundle ids, and this avoids executable-name/localization ambiguity.
  const switchId = spec.bundle || app;

  // First try agent-ctrl directly if the app is already running.
  let first = cp.spawnSync(AGENT_CTRL, ["switch-app", switchId], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  if ((first.status ?? 1) === 0) {
    return {
      code: 0,
      method: "agent-ctrl switch-app",
      app,
      stdout: first.stdout || "",
      stderr: first.stderr || "",
      seconds: (performance.now() - started) / 1000,
    };
  }

  // If it is not running (or switch-app cannot activate it), launch/activate
  // deterministically using bundle id where known.
  let launched;
  if (spec.bundle) {
    launched = cp.spawnSync("/usr/bin/open", ["-b", spec.bundle], {
      encoding: "utf8",
    });
  } else {
    launched = cp.spawnSync("/usr/bin/open", ["-a", app], {
      encoding: "utf8",
    });
  }

  if ((launched.status ?? 1) !== 0) {
    return {
      code: launched.status ?? 1,
      method: spec.bundle ? "open -b" : "open -a",
      app,
      stdout: launched.stdout || "",
      stderr:
        ((first.stdout || "") + (first.stderr || "") +
         (launched.stdout || "") + (launched.stderr || "")),
      seconds: (performance.now() - started) / 1000,
    };
  }

  // Give LaunchServices a moment, then ask agent-ctrl to pin to the canonical
  // process name. Failure here is not fatal: snapshot --target-process can
  // still establish the target on the next observation.
  cp.spawnSync("/bin/sleep", ["0.35"]);
  const repin = cp.spawnSync(AGENT_CTRL, ["switch-app", switchId], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const repinOk = (repin.status ?? 1) === 0;

  return {
    code: 0,
    method: repinOk
      ? `${spec.bundle ? "open -b" : "open -a"} + agent-ctrl switch-app`
      : `${spec.bundle ? "open -b" : "open -a"} (snapshot will pin target)`,
    app,
    stdout: (launched.stdout || "") + (repin.stdout || ""),
    stderr: repinOk ? "" : ((first.stderr || "") + (repin.stderr || "")),
    seconds: (performance.now() - started) / 1000,
  };
}


function normalizeFrontAsn(raw) {
  const asn = String(raw || "").trim();
  // Recent macOS versions have sometimes emitted ASN:0x0-ABC: while the
  // `info` command expects ASN:0x0-0xABC:. Keep both forms compatible.
  const m = asn.match(/^ASN:0x0-([0-9a-f]+):?$/i);
  return m ? `ASN:0x0-0x${m[1]}:` : asn;
}

function parseLsappinfoValue(raw, key) {
  const text = String(raw || "");
  const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`"${escaped}"\\s*=\\s*"([^"]*)"`, "i");
  const m = text.match(rx);
  return m ? m[1] : null;
}

function foregroundApp() {
  const started = performance.now();
  const cmd = "/usr/bin/lsappinfo";

  const front = cp.spawnSync(cmd, ["front"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  if ((front.status ?? 1) !== 0) {
    return {
      ok:false,
      name:null,
      bundle:null,
      seconds:(performance.now() - started) / 1000,
      error:(front.stderr || front.stdout || "lsappinfo front failed").trim(),
    };
  }

  const rawAsn = String(front.stdout || "").trim();
  const candidates = [...new Set([rawAsn, normalizeFrontAsn(rawAsn)].filter(Boolean))];

  let lastError = "";
  for (const asn of candidates) {
    const nameInfo = cp.spawnSync(cmd, ["info", "-only", "name", asn], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    const bundleInfo = cp.spawnSync(cmd, ["info", "-only", "bundleID", asn], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });

    const name = (nameInfo.status ?? 1) === 0
      ? parseLsappinfoValue(nameInfo.stdout, "LSDisplayName")
      : null;

    // lsappinfo has used both key spellings in output across macOS versions.
    const bundleRaw = bundleInfo.stdout || "";
    const bundle =
      parseLsappinfoValue(bundleRaw, "CFBundleIdentifier") ||
      parseLsappinfoValue(bundleRaw, "bundleID") ||
      parseLsappinfoValue(bundleRaw, "LSBundleIdentifier");

    if (name || bundle) {
      return {
        ok:true,
        name:name || bundle,
        bundle:bundle || null,
        asn,
        seconds:(performance.now() - started) / 1000,
        error:"",
      };
    }

    lastError =
      (nameInfo.stderr || nameInfo.stdout || "") +
      (bundleInfo.stderr || bundleInfo.stdout || "");
  }

  return {
    ok:false,
    name:null,
    bundle:null,
    asn:rawAsn || null,
    seconds:(performance.now() - started) / 1000,
    error:(lastError || "could not resolve frontmost application").trim(),
  };
}



function snapshotTarget(app) {
  const r = exec(["snapshot", "--target-process", app]);
  if (r.code !== 0) {
    throw new Error(`snapshot failed:\n${r.stderr || r.stdout}`);
  }
  return r;
}

function currentWindow() {
  const r = exec(["get", "window", "--json"]);
  if (r.code !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

function readBounds(ref) {
  const r = exec(["get", "bounds", ref]);
  if (r.code !== 0) {
    return {ok:false, error:(r.stderr || r.stdout || "get bounds failed").trim()};
  }

  try {
    const b = JSON.parse(r.stdout);
    if (
      Number.isFinite(Number(b.x)) &&
      Number.isFinite(Number(b.y)) &&
      Number.isFinite(Number(b.w)) &&
      Number.isFinite(Number(b.h))
    ) {
      return {
        ok:true,
        bounds:{
          x:Number(b.x), y:Number(b.y),
          w:Number(b.w), h:Number(b.h)
        }
      };
    }
  } catch {}

  return {ok:false, error:`invalid bounds response: ${r.stdout.trim()}`};
}

function activateForPointer(appName) {
  const spec = applicationSpec(appName);
  const switchId = spec.bundle || spec.process;

  let r = exec(["switch-app", switchId]);
  if (r.code === 0) {
    return {ok:true, method:`switch-app ${switchId}`, seconds:r.seconds};
  }

  // If the target stopped/restarted, re-open it and retry once.
  const started = performance.now();
  let launched;
  if (spec.bundle) {
    launched = cp.spawnSync("/usr/bin/open", ["-b", spec.bundle], {encoding:"utf8"});
  } else {
    launched = cp.spawnSync("/usr/bin/open", ["-a", spec.process], {encoding:"utf8"});
  }

  if ((launched.status ?? 1) !== 0) {
    return {
      ok:false,
      method:"activateForPointer",
      seconds:(performance.now() - started) / 1000,
      error:(launched.stderr || launched.stdout || r.stderr || r.stdout || "activation failed").trim()
    };
  }

  cp.spawnSync("/bin/sleep", ["0.20"]);
  r = exec(["switch-app", switchId]);

  return {
    ok:r.code === 0,
    method:`reopen + switch-app ${switchId}`,
    seconds:(performance.now() - started) / 1000,
    error:r.code === 0 ? "" : (r.stderr || r.stdout || "switch-app failed").trim()
  };
}

function deterministicPointerClick(ref, currentApp, providedBounds = null) {
  // This is intentionally NOT an LLM coordinate action.
  // Bounds come from the current Accessibility ref, and the runtime converts
  // them deterministically to the element center.
  const b =
    providedBounds &&
    Number.isFinite(Number(providedBounds.x)) &&
    Number.isFinite(Number(providedBounds.y)) &&
    Number.isFinite(Number(providedBounds.w)) &&
    Number.isFinite(Number(providedBounds.h))
      ? {
          ok:true,
          bounds:{
            x:Number(providedBounds.x),
            y:Number(providedBounds.y),
            w:Number(providedBounds.w),
            h:Number(providedBounds.h),
          }
        }
      : readBounds(ref);

  if (!b.ok) {
    return {ok:false, seconds:0, summary:`AX-bounds fallback failed: ${b.error}`};
  }

  const activation = activateForPointer(currentApp);
  if (!activation.ok) {
    return {
      ok:false,
      seconds:activation.seconds,
      summary:`AX-bounds fallback could not activate ${currentApp}: ${activation.error}`
    };
  }

  // agent-ctrl mouse commands require integer coordinates. AX bounds can
  // produce half-pixel centers when width/height are odd, so normalize the
  // deterministic center to the nearest integer before issuing CGEvent input.
  const x = Math.round(b.bounds.x + b.bounds.w / 2);
  const y = Math.round(b.bounds.y + b.bounds.h / 2);
  const started = performance.now();

  const move = exec(["mouse", "move", String(x), String(y)]);
  if (move.code !== 0) {
    return {
      ok:false,
      seconds:(performance.now() - started) / 1000 + activation.seconds,
      summary:`AX-bounds fallback mouse move failed: ${(move.stderr || move.stdout).trim()}`
    };
  }

  const down = exec(["mouse", "down", String(x), String(y), "--button", "left"]);
  if (down.code !== 0) {
    return {
      ok:false,
      seconds:(performance.now() - started) / 1000 + activation.seconds,
      summary:`AX-bounds fallback mouse down failed: ${(down.stderr || down.stdout).trim()}`
    };
  }

  const up = exec(["mouse", "up", String(x), String(y), "--button", "left"]);
  if (up.code !== 0) {
    return {
      ok:false,
      seconds:(performance.now() - started) / 1000 + activation.seconds,
      summary:`AX-bounds fallback mouse up failed: ${(up.stderr || up.stdout).trim()}`
    };
  }

  return {
    ok:true,
    seconds:(performance.now() - started) / 1000 + activation.seconds,
    summary:`deterministic AX-bounds CGEvent fallback via ${activation.method}`
  };
}


module.exports = {
  AGENT_CTRL,
  exec,
  activateApp,
  normalizeFrontAsn,
  parseLsappinfoValue,
  snapshotTarget,
  currentWindow,
  readBounds,
  activateForPointer,
  deterministicPointerClick,
};
