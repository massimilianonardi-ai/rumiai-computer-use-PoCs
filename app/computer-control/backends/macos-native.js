"use strict";

const cp = require("child_process");
const os = require("os");
const path = require("path");

function run(cmd, args, opts = {}) {
  const started = performance.now();
  const r = cp.spawnSync(cmd, args, {
    encoding:"utf8",
    maxBuffer:8 * 1024 * 1024,
    ...opts,
  });

  return {
    ok:(r.status ?? 1) === 0,
    code:r.status ?? 1,
    stdout:r.stdout || "",
    stderr:r.stderr || "",
    seconds:(performance.now() - started) / 1000,
    method:`${cmd} ${args.join(" ")}`,
  };
}


function normalizeFrontAsn(raw) {
  const asn = String(raw || "").trim();
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

function foregroundApplication() {
  const started = performance.now();
  const cmd = "/usr/bin/lsappinfo";

  const front = cp.spawnSync(cmd, ["front"], {
    encoding:"utf8",
    maxBuffer:1024 * 1024,
  });

  if ((front.status ?? 1) !== 0) {
    return {
      ok:false,
      name:null,
      bundle:null,
      seconds:(performance.now() - started) / 1000,
      method:"macOS lsappinfo",
      error:(front.stderr || front.stdout || "lsappinfo front failed").trim(),
    };
  }

  const rawAsn = String(front.stdout || "").trim();
  const candidates = [
    ...new Set([rawAsn, normalizeFrontAsn(rawAsn)].filter(Boolean))
  ];

  let lastError = "";

  for (const asn of candidates) {
    const nameInfo = cp.spawnSync(
      cmd,
      ["info", "-only", "name", asn],
      {encoding:"utf8", maxBuffer:1024 * 1024}
    );
    const bundleInfo = cp.spawnSync(
      cmd,
      ["info", "-only", "bundleID", asn],
      {encoding:"utf8", maxBuffer:1024 * 1024}
    );

    const name = (nameInfo.status ?? 1) === 0
      ? parseLsappinfoValue(nameInfo.stdout, "LSDisplayName")
      : null;

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
        method:"macOS lsappinfo",
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
    method:"macOS lsappinfo",
    error:(lastError || "could not resolve frontmost application").trim(),
  };
}


function plistValue(appPath, key) {
  if (!appPath || !String(appPath).endsWith(".app")) return null;

  const plist = path.join(appPath, "Contents", "Info.plist");
  const r = run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist]);

  if (!r.ok) return null;
  const value = String(r.stdout || "").trim();
  return value || null;
}

function resolveApplicationIdentity(provider, exactPath) {
  const bundle =
    plistValue(exactPath, "CFBundleIdentifier") ||
    provider?.identity?.bundle ||
    null;

  const executable =
    plistValue(exactPath, "CFBundleExecutable") ||
    provider?.identity?.process ||
    provider?.activation?.application ||
    provider?.name ||
    null;

  const displayName =
    plistValue(exactPath, "CFBundleDisplayName") ||
    plistValue(exactPath, "CFBundleName") ||
    provider?.name ||
    executable;

  return {
    path:exactPath,
    bundle,
    executable,
    displayName,
  };
}

/*
 * RumiAI itself intentionally runs in an isolated/portable shell environment:
 *
 *   HOME=<RumiAI>/home
 *   XDG_CACHE_HOME=<RumiAI>/home/cache
 *   modified PATH, model/runtime variables, etc.
 *
 * Desktop Providers must NOT inherit that private runtime environment.
 * A normal GUI application should see the logged-in macOS user's identity,
 * not RumiAI's portable HOME.
 *
 * Build a deliberately small desktop-user environment instead of forwarding
 * process.env wholesale. This is a generic OS boundary, not an app-specific
 * Pulsar workaround.
 */
function desktopUserEnvironment(sourceEnv = process.env) {
  const user = os.userInfo();

  const env = {
    HOME:user.homedir,
    USER:user.username,
    LOGNAME:user.username,
    PATH:"/usr/bin:/bin:/usr/sbin:/sbin",
  };

  // Preserve normal login/session values that are useful to GUI applications
  // without leaking the private RumiAI runtime.
  const passthroughExact = [
    "TMPDIR",
    "SHELL",
    "LANG",
    "__CF_USER_TEXT_ENCODING",
    "SECURITYSESSIONID",
  ];

  for (const key of passthroughExact) {
    const value = sourceEnv[key];
    if (value) env[key] = value;
  }

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (/^LC_/.test(key) && value) env[key] = value;
  }

  return env;
}

function launchApplicationBundle(exactPath) {
  if (!exactPath) {
    return {
      ok:false, code:1, stdout:"", stderr:"missing application path",
      seconds:0, method:"macOS LaunchServices",
    };
  }

  const env = desktopUserEnvironment();

  // Launch the exact .app bundle through LaunchServices, but from a clean
  // logged-in-user environment. In particular, do not leak RumiAI's portable
  // HOME/XDG/runtime variables into the external application.
  const r = run("/usr/bin/open", [exactPath], {env});

  return {
    ...r,
    method:`macOS LaunchServices clean-env "${exactPath}"`,
    launchEnvironment:{
      HOME:env.HOME,
      USER:env.USER,
      PATH:env.PATH,
      TMPDIR:env.TMPDIR || null,
    },
  };
}


function ensureAxManualHelper() {
  const helperSource = path.resolve(__dirname, "..", "..", "..", "tools", "enable-ax-manual.swift");
  const helperBin = path.resolve(__dirname, "..", "..", "..", "bin", "rumiai-enable-ax-manual");

  const fs = require("fs");

  if (fs.existsSync(helperBin)) {
    return {ok:true, path:helperBin, compiled:false, seconds:0};
  }

  const which = run("/usr/bin/xcrun", ["--find", "swiftc"]);
  if (!which.ok) {
    return {
      ok:false,
      error:"swiftc not available through xcrun",
      detail:(which.stderr || which.stdout || "").trim(),
      seconds:which.seconds,
    };
  }

  const compiled = run("/usr/bin/xcrun", [
    "swiftc",
    helperSource,
    "-o",
    helperBin,
  ]);

  if (!compiled.ok) {
    return {
      ok:false,
      error:"failed to compile AXManualAccessibility helper",
      detail:(compiled.stderr || compiled.stdout || "").trim(),
      seconds:compiled.seconds,
    };
  }

  try { fs.chmodSync(helperBin, 0o755); } catch {}

  return {
    ok:true,
    path:helperBin,
    compiled:true,
    seconds:which.seconds + compiled.seconds,
  };
}

function enableManualAccessibility(identity) {
  const helper = ensureAxManualHelper();

  if (!helper.ok) {
    return {
      ok:false,
      method:"AXManualAccessibility helper unavailable",
      seconds:helper.seconds || 0,
      error:helper.error,
      detail:helper.detail || "",
    };
  }

  const bundle = identity?.bundle || "-";
  const name =
    identity?.displayName ||
    identity?.executable ||
    "";

  const r = run(helper.path, [bundle, name]);

  return {
    ok:r.ok,
    method:"AXManualAccessibility=true",
    seconds:(helper.seconds || 0) + r.seconds,
    stdout:r.stdout,
    stderr:r.stderr,
    compiled:helper.compiled,
  };
}

module.exports = {
  run,
  normalizeFrontAsn,
  parseLsappinfoValue,
  foregroundApplication,
  plistValue,
  resolveApplicationIdentity,
  desktopUserEnvironment,
  launchApplicationBundle,
  ensureAxManualHelper,
  enableManualAccessibility,
};
