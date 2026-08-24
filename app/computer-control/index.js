"use strict";

const {
  loadProviders,
  providerAvailable,
  providerResolvedPath,
  providerForApplication,
} = require("../provider-manager");

const agentCtrl = require("./backends/agent-ctrl");
const operations = require("./operations");
const {loadDesktopPlugin} = require("./desktop");

const desktop = loadDesktopPlugin();

const DEFAULT_READY_TIMEOUT_MS = Number(
  process.env.RUMIAI_APP_READY_TIMEOUT_MS || "12000"
);
const READY_POLL_MS = Number(
  process.env.RUMIAI_APP_READY_POLL_MS || "250"
);

const DEFAULT_RESOURCE_READY_TIMEOUT_MS = Number(
  process.env.RUMIAI_RESOURCE_READY_TIMEOUT_MS || "12000"
);
const RESOURCE_READY_POLL_MS = Number(
  process.env.RUMIAI_RESOURCE_READY_POLL_MS || "300"
);


function runtimeInfo() {
  return agentCtrl.runtimeInfo();
}

function ensureRuntime() {
  return agentCtrl.ensureRuntime();
}

function shutdownRuntime() {
  return agentCtrl.shutdownRuntime();
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function norm(x) {
  return String(x || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sameForeground(provider, observed, identity = null) {
  if (!provider || !observed?.ok) return false;

  const providerBundle = String(
    identity?.bundle || provider?.identity?.bundle || ""
  ).trim();

  if (providerBundle && observed.bundle) {
    return providerBundle.toLowerCase() === observed.bundle.toLowerCase();
  }

  const names = [
    identity?.displayName,
    identity?.executable,
    provider.name,
    provider.activation?.application,
    provider.identity?.process,
    ...(Array.isArray(provider.aliases) ? provider.aliases : [])
  ].map(norm).filter(Boolean);

  return names.includes(norm(observed.name));
}

function resultError(error, detail, diagnostics = {}) {
  return {
    ok:false,
    error,
    detail,
    state:error,
    diagnostics,
  };
}

function resolveApplicationProvider(app) {
  const providers = loadProviders();
  return providerForApplication(app, providers);
}

function resolveDesktopApplication(provider) {
  const exactPath = providerResolvedPath(provider);
  const resolved = desktop.resolveApplication({provider, exactPath});

  if (!resolved?.ok || !resolved.identity) {
    return {
      ok:false,
      error:resolved?.error || "APP_RESOLVE_FAILED",
      detail:resolved?.detail ||
        `Desktop plugin "${desktop.id}" could not resolve "${provider?.name || "application"}"`,
      exactPath,
      desktopPlugin:desktop.id,
    };
  }

  const identity = resolved.identity;

  return {
    ok:true,
    exactPath,
    identity,
    application:{
      ...resolved,
      provider,
      identity,
      exactPath,
    },
  };
}

function getForeground() {
  const started = performance.now();
  const observed = desktop.getForegroundApplication();

  if (!observed?.ok) {
    return {
      ok:false,
      error:"FOREGROUND_OBSERVATION_FAILED",
      detail:observed?.error || observed?.detail || "frontmost application unavailable",
      state:"FAILED",
      method:observed?.method || `desktop plugin ${desktop.id} foreground observation`,
      observeSeconds:observed?.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    name:observed.name,
    bundle:observed.bundle || null,
    asn:observed.asn || null,
    method:observed.method || `desktop plugin ${desktop.id} foreground observation`,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

function getCurrentWindow({app} = {}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"getCurrentWindow requires an application",
      state:"FAILED",
    };
  }

  const provider = resolveApplicationProvider(app);
  if (!provider) {
    return {
      ok:false,
      error:"PROVIDER_NOT_FOUND",
      detail:`No application Provider registered for "${app}"`,
      state:"FAILED",
    };
  }

  const desktopResolved = resolveDesktopApplication(provider);
  if (!desktopResolved.ok) {
    return {
      ok:false,
      error:desktopResolved.error,
      detail:desktopResolved.detail,
      state:"FAILED",
    };
  }

  const observed = desktop.getCurrentWindow(desktopResolved.application);

  if (!observed?.ok || !observed.window) {
    return {
      ok:false,
      error:"WINDOW_OBSERVATION_FAILED",
      detail:(
        observed?.detail ||
        observed?.stderr ||
        observed?.stdout ||
        "current window unavailable"
      ).trim(),
      state:"FAILED",
      method:observed?.method || `desktop plugin ${desktop.id} current-window observation`,
      observeSeconds:observed?.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    window:observed.window,
    method:observed.method || `desktop plugin ${desktop.id} current-window observation`,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

function listWindows({app} = {}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"listWindows requires an application",
      state:"FAILED",
    };
  }

  const provider = resolveApplicationProvider(app);
  if (!provider) {
    return {
      ok:false,
      error:"PROVIDER_NOT_FOUND",
      detail:`No application Provider registered for "${app}"`,
      state:"FAILED",
    };
  }

  const desktopResolved = resolveDesktopApplication(provider);
  if (!desktopResolved.ok) {
    return {
      ok:false,
      error:desktopResolved.error,
      detail:desktopResolved.detail,
      state:"FAILED",
    };
  }

  const observed = desktop.listWindows(desktopResolved.application);

  if (!observed?.ok || !Array.isArray(observed.windows)) {
    return {
      ok:false,
      error:observed?.error || "WINDOW_LIST_FAILED",
      detail:(
        observed?.detail ||
        observed?.stderr ||
        observed?.stdout ||
        "window list unavailable"
      ).trim(),
      state:observed?.state || "FAILED",
      windows:[],
      method:observed?.method || `desktop plugin ${desktop.id} window-list observation`,
      observeSeconds:observed?.observeSeconds || observed?.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    windows:observed.windows,
    method:observed.method || `desktop plugin ${desktop.id} window-list observation`,
    observeSeconds:observed.observeSeconds || observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

function closeWindow({app} = {}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"closeWindow requires an application",
      state:"FAILED",
    };
  }

  const provider = resolveApplicationProvider(app);
  if (!provider) {
    return {
      ok:false,
      error:"PROVIDER_NOT_FOUND",
      detail:`No application Provider registered for "${app}"`,
      state:"FAILED",
    };
  }

  const desktopResolved = resolveDesktopApplication(provider);
  if (!desktopResolved.ok) {
    return {
      ok:false,
      error:desktopResolved.error,
      detail:desktopResolved.detail,
      state:"FAILED",
    };
  }

  const result = desktop.closeWindow(desktopResolved.application);

  if (!result?.ok) {
    return {
      ok:false,
      error:result?.error || "WINDOW_CLOSE_FAILED",
      detail:
        result?.detail ||
        `Desktop plugin "${desktop.id}" could not verify window close`,
      state:result?.state || "FAILED",
      window:result?.window || null,
      currentWindow:result?.currentWindow || null,
      method:result?.method || `desktop plugin ${desktop.id} close-window`,
      verified:false,
      verificationMethod:result?.verification || "none",
      actionSeconds:result?.actionSeconds || 0,
      observeSeconds:result?.observeSeconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"CLOSED",
    window:result.window || null,
    currentWindow:result.currentWindow || null,
    method:result.method || `desktop plugin ${desktop.id} close-window`,
    verified:result.verified === true,
    verificationMethod:result.verification || "current-window-changed-or-absent",
    actionSeconds:result.actionSeconds || 0,
    observeSeconds:result.observeSeconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

async function ensureReady(providerOrApp, opts = {}) {
  const started = performance.now();
  const timeoutMs = Number(opts.timeoutMs || DEFAULT_READY_TIMEOUT_MS);

  const provider =
    typeof providerOrApp === "string"
      ? resolveApplicationProvider(providerOrApp)
      : providerOrApp;

  if (!provider) {
    return resultError(
      "PROVIDER_NOT_FOUND",
      `No application Provider registered for "${providerOrApp}"`,
      {provider:providerOrApp}
    );
  }

  if (provider.kind !== "application") {
    return resultError(
      "UNSUPPORTED_PROVIDER_KIND",
      `ensureReady only supports application Providers in this micro-PoC`,
      {provider:provider.id, kind:provider.kind}
    );
  }

  if (!providerAvailable(provider)) {
    return resultError(
      "PROVIDER_UNAVAILABLE",
      `Application Provider "${provider.name}" is not installed at a registered path`,
      {provider:provider.id}
    );
  }

  const desktopResolved = resolveDesktopApplication(provider);

  if (!desktopResolved.ok) {
    return resultError(
      desktopResolved.error,
      desktopResolved.detail,
      {
        provider:provider.id,
        exactPath:desktopResolved.exactPath,
        desktopPlugin:desktop.id,
      }
    );
  }

  const {
    exactPath,
    identity,
    application,
  } = desktopResolved;

  const processName =
    identity.executable ||
    provider?.identity?.process ||
    provider?.activation?.application ||
    provider.name;

  const diagnostics = {
    provider:provider.id,
    exactPath,
    identity,
    processName,
    desktopPlugin:desktop.id,
    launchAttempted:false,
    launchMethod:null,
    switchAttempts:0,
    snapshotAttempts:0,
    lastSwitchError:"",
    lastSnapshotError:"",
    foreground:null,
  };

  let actionSeconds = 0;
  let observeSeconds = 0;

  // Phase 1: ask the selected Desktop Plugin to activate the application.
  // Computer Control owns the lifecycle contract; the plugin owns the OS HOW.
  let switched = desktop.activateApplication(application);
  diagnostics.switchAttempts += 1;
  actionSeconds += switched.seconds || 0;

  // Phase 2: if activation fails, launch through the Desktop Plugin and retry.
  // No OS-specific launch mechanism is exposed at this layer.
  if (!switched.ok) {
    diagnostics.launchAttempted = true;

    const launched = desktop.launchApplication(application);
    actionSeconds += launched.seconds || 0;
    diagnostics.launchMethod = launched.method || null;
    diagnostics.launchEnvironment = launched.launchEnvironment || null;

    if (!launched.ok) {
      return resultError(
        "APP_LAUNCH_FAILED",
        `Could not launch "${provider.name}" through desktop plugin "${desktop.id}"`,
        {
          ...diagnostics,
          backendError:(launched.stderr || launched.stdout || launched.detail || "").trim(),
          elapsedSeconds:(performance.now() - started) / 1000,
        }
      );
    }
  }

  // Phase 3: STARTING is an internal lifecycle state, not an LLM recovery
  // condition. Desktop activation/foreground observation stay behind the
  // platform plugin; accessibility snapshotting stays behind the UI backend.
  const deadline = performance.now() + timeoutMs;
  let snapshot = null;
  let finalSwitchMethod = switched.ok ? switched.method : null;

  while (performance.now() < deadline) {
    if (!switched.ok) {
      switched = desktop.activateApplication(application);
      diagnostics.switchAttempts += 1;
      actionSeconds += switched.seconds || 0;

      if (switched.ok) {
        finalSwitchMethod = switched.method;
        diagnostics.lastSwitchError = "";
      } else {
        diagnostics.lastSwitchError =
          (switched.stderr || switched.stdout || switched.detail || "").trim();
      }
    }

    if (switched.ok) {
      const observed = agentCtrl.snapshotApplication(provider, identity, true);
      diagnostics.snapshotAttempts += 1;
      observeSeconds += observed.seconds;

      if (observed.ok) {
        snapshot = observed;

        const front = getForeground();
        diagnostics.foreground = front.ok
          ? {name:front.name, bundle:front.bundle}
          : {error:front.error || front.detail || "foreground unavailable"};

        if (sameForeground(provider, front, identity)) {
          return {
            ok:true,
            state:"READY",
            provider,
            currentApp:processName,
            snapshot:observed.stdout,
            changed:true,
            actionSeconds,
            observeSeconds,
            detail:
              `ensureReady provider="${provider.name}"; ` +
              `desktop=${desktop.id}; ` +
              `path="${exactPath}"; executable="${identity.executable || ""}"; ` +
              `bundle="${identity.bundle || ""}"; launch=${diagnostics.launchAttempted}; ` +
              `switch=${finalSwitchMethod || "none"}; ` +
              `snapshot=settled; foreground=${front.name}; ` +
              `switchAttempts=${diagnostics.switchAttempts}; ` +
              `snapshotAttempts=${diagnostics.snapshotAttempts}`,
            diagnostics:{
              ...diagnostics,
              elapsedSeconds:(performance.now() - started) / 1000,
            },
          };
        }
      } else {
        diagnostics.lastSnapshotError =
          (observed.stderr || observed.stdout || "").trim();
      }
    }

    await sleep(READY_POLL_MS);
  }

  return resultError(
    "APP_NOT_READY",
    `Application "${provider.name}" did not reach verified READY state within ${timeoutMs}ms`,
    {
      ...diagnostics,
      elapsedSeconds:(performance.now() - started) / 1000,
    }
  );
}


/*
 * Generic resource synchronization primitive.
 *
 * Computer Control owns HOW to observe/poll a desktop Provider reliably.
 * The caller owns WHAT condition makes its next operation possible.
 *
 * predicate(snapshot) may return:
 *   - false/null: condition not satisfied yet
 *   - true: condition satisfied
 *   - any object/value: condition satisfied and returned as evidence
 *
 * This deliberately contains no document/editor/Pulsar semantics.
 */
async function waitUntilSnapshotCondition(providerOrApp, predicate, opts = {}) {
  const started = performance.now();
  const timeoutMs = Number(
    opts.timeoutMs || DEFAULT_RESOURCE_READY_TIMEOUT_MS
  );
  const pollMs = Number(opts.pollMs || RESOURCE_READY_POLL_MS);
  // Historical resource-readiness behavior uses a full snapshot. Callers that
  // compare against an existing compact snapshot must explicitly request
  // compact=true so representation depth itself cannot create a false change.
  const compact = opts.compact === undefined
    ? false
    : Boolean(opts.compact);

  if (typeof predicate !== "function") {
    return resultError(
      "INVALID_READY_CONDITION",
      "waitUntilSnapshotCondition requires a predicate function"
    );
  }

  const provider =
    typeof providerOrApp === "string"
      ? resolveApplicationProvider(providerOrApp)
      : providerOrApp;

  if (!provider) {
    return resultError(
      "PROVIDER_NOT_FOUND",
      `No application Provider registered for "${providerOrApp}"`
    );
  }

  const desktopResolved = resolveDesktopApplication(provider);
  if (!desktopResolved.ok) {
    return resultError(
      desktopResolved.error,
      desktopResolved.detail,
      {
        provider:provider.id,
        exactPath:desktopResolved.exactPath,
        desktopPlugin:desktop.id,
      }
    );
  }

  const identity = desktopResolved.identity;
  const deadline = performance.now() + timeoutMs;

  let attempts = 0;
  let observeSeconds = 0;
  let lastSnapshotError = "";
  let previousSnapshot = null;

  while (performance.now() < deadline) {
    const observed = agentCtrl.snapshotApplication(
      provider,
      identity,
      false,
      {compact}
    );
    attempts += 1;
    observeSeconds += observed.seconds;

    if (observed.ok) {
      const elapsedMs = performance.now() - started;
      const snapshotChanged =
        previousSnapshot === null || observed.stdout !== previousSnapshot;

      if (typeof opts.onObservation === "function") {
        try {
          opts.onObservation({
            snapshot:observed.stdout,
            attempt:attempts,
            elapsedMs,
            changed:snapshotChanged,
          });
        } catch {
          // Diagnostics must never affect synchronization behavior.
        }
      }

      previousSnapshot = observed.stdout;

      let evidence = false;

      try {
        evidence = predicate(observed.stdout);
      } catch (e) {
        return resultError(
          "READY_CONDITION_ERROR",
          `Resource readiness predicate failed: ${e.message}`,
          {attempts}
        );
      }

      if (evidence) {
        return {
          ok:true,
          state:"CONDITION_READY",
          provider,
          snapshot:observed.stdout,
          evidence:evidence === true ? null : evidence,
          observeSeconds,
          waitSeconds:(performance.now() - started) / 1000,
          attempts,
          detail:
            `snapshot condition ready; provider="${provider.name}"; ` +
            `desktop=${desktop.id}; compact=${compact}; attempts=${attempts}`,
        };
      }
    } else {
      lastSnapshotError =
        (observed.stderr || observed.stdout || "").trim();
    }

    await sleep(pollMs);
  }

  return resultError(
    "RESOURCE_NOT_READY",
    `Required interaction condition did not become true within ${timeoutMs}ms`,
    {
      provider:provider.id,
      desktopPlugin:desktop.id,
      attempts,
      lastSnapshotError,
      elapsedSeconds:(performance.now() - started) / 1000,
    }
  );
}


/*
 * Public synchronization alias.
 * Kept separate from the legacy/internal name so Skills/Executors depend on
 * the RumiAI contract rather than implementation naming.
 */
async function waitUntil(providerOrApp, predicate, opts = {}) {
  return waitUntilSnapshotCondition(providerOrApp, predicate, opts);
}

/*
 * Common result-oriented synchronization:
 * wait until the Provider snapshot differs from a known previous state.
 */
async function waitUntilChanged(providerOrApp, previousSnapshot, opts = {}) {
  const before = String(previousSnapshot || "");
  const compact = opts.compact === undefined
    ? true
    : Boolean(opts.compact);

  const result = await waitUntilSnapshotCondition(
    providerOrApp,
    snapshot => snapshot !== before
      ? {changed:true}
      : false,
    {...opts, compact}
  );

  if (!result.ok) return result;

  return {
    ...result,
    state:"CHANGED",
    changed:true,
    detail:
      `snapshot changed; provider="${result.provider?.name || providerOrApp}"; ` +
      `compact=${compact}; attempts=${result.attempts}`,
  };
}

module.exports = {
  runtimeInfo,
  ensureRuntime,
  shutdownRuntime,
  DEFAULT_READY_TIMEOUT_MS,
  READY_POLL_MS,
  DEFAULT_RESOURCE_READY_TIMEOUT_MS,
  RESOURCE_READY_POLL_MS,
  resolveApplicationProvider,
  sameForeground,
  ensureReady,
  waitUntilSnapshotCondition,
  waitUntil,
  waitUntilChanged,
  getForeground,
  waitStable:operations.waitStable,
  getCurrentWindow,
  listWindows,
  closeWindow,
  snapshot:operations.snapshot,
  getBounds:operations.getBounds,
  find:operations.find,
  get:operations.get,
  focus:operations.focus,
  press:operations.press,
  click:operations.click,
  setText:operations.setText,
  clear:operations.clear,
};