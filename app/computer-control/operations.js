"use strict";

const {
  loadProviders,
  providerResolvedPath,
  providerForApplication,
} = require("../provider-manager");

const agentCtrl = require("./backends/agent-ctrl");
const macosNative = require("./backends/macos-native");

function normText(x) {
  return String(x || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function unquote(x) {
  return String(x || "").replace(/^"|"$/g, "").trim();
}

function resolveProvider(app) {
  return providerForApplication(app, loadProviders());
}

function resolveProviderIdentity(app) {
  const provider = resolveProvider(app);
  if (!provider) {
    return {
      ok:false,
      error:"PROVIDER_NOT_FOUND",
      detail:`No application Provider registered for "${app}"`,
    };
  }

  const exactPath = providerResolvedPath(provider);
  const identity = macosNative.resolveApplicationIdentity(provider, exactPath);

  return {ok:true, provider, identity};
}

function decodeObservedText(raw) {
  // agent-ctrl writes command output to stdout. Remove only the transport line
  // ending added by the CLI; do not trim or normalize the observed value.
  let value = String(raw == null ? "" : raw).replace(/\r?\n$/, "");

  // AX scalar values may be emitted as JSON-style quoted strings. Decode only
  // the transport representation so the comparison below remains literal.
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded === "string") return decoded;
    } catch (_) {
      // Fall through: an unparseable quoted value is still observable data.
    }
  }

  return value;
}

function verifyTextByElement(ref, text) {
  const requested = String(text == null ? "" : text);

  const gotValue = agentCtrl.getElementValue(ref);
  if (gotValue.ok) {
    const value = decodeObservedText(gotValue.stdout);
    if (value === requested) {
      return {
        ok:true,
        method:"ax-value-exact",
        observed:value,
        seconds:gotValue.seconds,
      };
    }
  }

  const gotText = agentCtrl.getElementText(ref);
  if (gotText.ok) {
    const value = decodeObservedText(gotText.stdout);
    if (value === requested) {
      return {
        ok:true,
        method:"ax-text-exact",
        observed:value,
        seconds:(gotValue.seconds || 0) + gotText.seconds,
      };
    }
  }

  return {
    ok:false,
    method:"none",
    observed:"",
    seconds:(gotValue.seconds || 0) + (gotText.seconds || 0),
  };
}

function verifyFocusedElementByClipboard(ref, text) {
  let seconds = 0;

  // Verification is bound to the exact semantic element, never to whichever
  // control happened to be focused previously.
  const focused = agentCtrl.focusElement(ref);
  seconds += focused.seconds || 0;

  if (!focused.ok) {
    return {
      ok:false,
      method:"none",
      observed:"",
      seconds,
      error:(focused.stderr || focused.stdout || "focus failed").trim(),
    };
  }

  const before = agentCtrl.clipboardRead();
  seconds += before.seconds || 0;

  const sentinel =
    `__RUMIAI_VERIFY_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

  let copiedText = "";
  let verified = false;

  const wrote = agentCtrl.clipboardWrite(sentinel);
  seconds += wrote.seconds || 0;

  if (wrote.ok) {
    const selectAll = agentCtrl.pressKeys("Cmd+A");
    seconds += selectAll.seconds || 0;

    if (selectAll.ok) {
      const copied = agentCtrl.clipboardCopy();
      seconds += copied.seconds || 0;

      if (copied.ok) {
        const readBack = agentCtrl.clipboardRead();
        seconds += readBack.seconds || 0;

        if (readBack.ok) {
          copiedText = decodeObservedText(readBack.stdout);
          verified =
            copiedText !== sentinel &&
            copiedText === String(text == null ? "" : text);
        }
      }
    }
  }

  if (before.ok) {
    const restored = agentCtrl.clipboardWrite(String(before.stdout || ""));
    seconds += restored.seconds || 0;
  }

  // Collapse verification selection without changing the value.
  const collapse = agentCtrl.pressKeys("Right");
  seconds += collapse.seconds || 0;

  return {
    ok:verified,
    method:verified ? "focused-element-clipboard-exact" : "none",
    observed:copiedText,
    seconds,
  };
}

function verifyExactTextPostcondition(providerResolved, ref, text) {
  let seconds = 0;

  // Strongest evidence: the exact value/text exposed by accessibility.
  const direct = verifyTextByElement(ref, text);
  seconds += direct.seconds || 0;
  if (direct.ok) return {...direct, seconds};

  // Keep a fresh target snapshot for diagnostics only. A serialized snapshot
  // line contains structural metadata and therefore cannot prove exact SET
  // equality without backend-specific parsing.
  const snapshot = agentCtrl.snapshotApplication(
    providerResolved.provider,
    providerResolved.identity,
    false
  );
  seconds += snapshot.seconds || 0;

  // Some controls (notably browser-like fields) accept input but do not expose
  // the value through AX get/text. Bind exact clipboard verification to ref.
  const copied = verifyFocusedElementByClipboard(ref, text);
  seconds += copied.seconds || 0;

  return {
    ...copied,
    snapshot:snapshot.ok ? snapshot.stdout : null,
    seconds,
  };
}

function replaceFocusedValueByClipboard(ref, text) {
  let seconds = 0;

  const focused = agentCtrl.focusElement(ref);
  seconds += focused.seconds || 0;
  if (!focused.ok) {
    return {
      ok:false,
      seconds,
      error:(focused.stderr || focused.stdout || "focus failed").trim(),
    };
  }

  const selected = agentCtrl.pressKeys("Cmd+A");
  seconds += selected.seconds || 0;
  if (!selected.ok) {
    return {
      ok:false,
      seconds,
      error:(selected.stderr || selected.stdout || "select all failed").trim(),
    };
  }

  const before = agentCtrl.clipboardRead();
  seconds += before.seconds || 0;

  const wrote = agentCtrl.clipboardWrite(String(text));
  seconds += wrote.seconds || 0;

  if (!wrote.ok) {
    return {
      ok:false,
      seconds,
      error:(wrote.stderr || wrote.stdout || "clipboard write failed").trim(),
    };
  }

  const pasted = agentCtrl.clipboardPaste();
  seconds += pasted.seconds || 0;

  if (before.ok) {
    const restored = agentCtrl.clipboardWrite(String(before.stdout || ""));
    seconds += restored.seconds || 0;
  }

  return {
    ok:pasted.ok,
    seconds,
    error:pasted.ok ? "" : (pasted.stderr || pasted.stdout || "paste failed").trim(),
  };
}

function replaceFocusedValueByTyping(ref, text) {
  let seconds = 0;

  const focused = agentCtrl.focusElement(ref);
  seconds += focused.seconds || 0;
  if (!focused.ok) {
    return {
      ok:false,
      seconds,
      error:(focused.stderr || focused.stdout || "focus failed").trim(),
    };
  }

  const selected = agentCtrl.pressKeys("Cmd+A");
  seconds += selected.seconds || 0;
  if (!selected.ok) {
    return {
      ok:false,
      seconds,
      error:(selected.stderr || selected.stdout || "select all failed").trim(),
    };
  }

  const typed = agentCtrl.typeText(String(text));
  seconds += typed.seconds || 0;

  return {
    ok:typed.ok,
    seconds,
    error:typed.ok ? "" : (typed.stderr || typed.stdout || "type failed").trim(),
  };
}

function clearFocusedValueByDelete(ref) {
  let seconds = 0;

  const focused = agentCtrl.focusElement(ref);
  seconds += focused.seconds || 0;
  if (!focused.ok) {
    return {
      ok:false,
      seconds,
      error:(focused.stderr || focused.stdout || "focus failed").trim(),
    };
  }

  const selected = agentCtrl.pressKeys("Cmd+A");
  seconds += selected.seconds || 0;
  if (!selected.ok) {
    return {
      ok:false,
      seconds,
      error:(selected.stderr || selected.stdout || "select all failed").trim(),
    };
  }

  const deleted = agentCtrl.pressKeys("Backspace");
  seconds += deleted.seconds || 0;

  return {
    ok:deleted.ok,
    seconds,
    error:deleted.ok ? "" : (deleted.stderr || deleted.stdout || "delete failed").trim(),
  };
}





/*
 * Public Computer Control application-state observation:
 *
 *   getForeground()
 *
 * Contract:
 *   returns the actual frontmost desktop application observed by the native OS
 *   backend. This is independent from RumiAI's persistent working-app state.
 */
function getForeground() {
  const started = performance.now();
  const observed = macosNative.foregroundApplication();

  if (!observed.ok) {
    return {
      ok:false,
      error:"FOREGROUND_OBSERVATION_FAILED",
      detail:observed.error || "frontmost application unavailable",
      state:"FAILED",
      method:observed.method || "macOS foreground observation",
      observeSeconds:observed.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    name:observed.name,
    bundle:observed.bundle || null,
    asn:observed.asn || null,
    method:observed.method || "macOS foreground observation",
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}


/*
 * Public Computer Control synchronization:
 *
 *   waitStable({ app, timeoutMs=5000, pollMs=200 })
 *
 * Contract:
 *   waits until the backend considers the current UI accessibility surface
 *   stable, then returns a fresh snapshot.
 *
 * Stability is mechanical/observational. It is not a semantic task success.
 */
function waitStable({
  app,
  timeoutMs = 5000,
  pollMs = 200,
}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"waitStable requires an application",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const waited = agentCtrl.waitStable(timeoutMs, pollMs);

  if (!waited.ok) {
    return {
      ok:false,
      error:"STABILITY_WAIT_FAILED",
      detail:(waited.stderr || waited.stdout || "wait-for stable failed").trim(),
      state:"FAILED",
      method:waited.method,
      waitSeconds:waited.seconds || 0,
      observeSeconds:0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  const observed = agentCtrl.snapshotApplication(
    providerResolved.provider,
    providerResolved.identity,
    false
  );

  return {
    ok:observed.ok,
    error:observed.ok ? null : "POST_STABILITY_SNAPSHOT_FAILED",
    detail:observed.ok
      ? `stable via ${waited.method}`
      : (observed.stderr || observed.stdout || "snapshot after stable failed").trim(),
    state:observed.ok ? "STABLE" : "FAILED",
    snapshot:observed.ok ? observed.stdout : null,
    method:waited.method,
    waitSeconds:waited.seconds || 0,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control Window API:
 *
 *   getCurrentWindow({ app })
 *
 * Contract:
 *   PRE: `app` identifies the registered working application.
 *   POST: returns the backend's current-window metadata without interpreting
 *         application semantics.
 *
 * This first Window API slice intentionally exposes only a capability already
 * exercised by the PoC. listWindows()/focusWindow() are deferred until backend
 * support is explicitly demonstrated instead of being guessed.
 */
function getCurrentWindow({app}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"getCurrentWindow requires an application",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const observed = agentCtrl.getCurrentWindow();

  if (!observed.ok || !observed.window) {
    return {
      ok:false,
      error:"WINDOW_OBSERVATION_FAILED",
      detail:(observed.stderr || observed.stdout || "current window unavailable").trim(),
      state:"FAILED",
      method:observed.method,
      observeSeconds:observed.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    window:observed.window,
    method:observed.method,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control API observation:
 *
 *   snapshot({ app, settle=false, compact=true, previousSnapshot=null })
 *
 * Contract:
 *   PRE:  `app` identifies a registered application Provider.
 *   POST: returns the current accessibility representation for that Provider.
 *
 * No application semantics are inferred here. `changed` is purely an
 * observation delta against an optional caller-supplied previous snapshot.
 */
function snapshot({
  app,
  settle = false,
  compact = true,
  previousSnapshot = null,
}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"snapshot requires an application",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const observed = agentCtrl.snapshotApplication(
    providerResolved.provider,
    providerResolved.identity,
    Boolean(settle),
    {compact:compact !== false}
  );

  if (!observed.ok) {
    return {
      ok:false,
      error:"SNAPSHOT_FAILED",
      detail:(observed.stderr || observed.stdout || "snapshot failed").trim(),
      state:"FAILED",
      method:observed.method,
      observeSeconds:observed.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  const value = String(observed.stdout || "");
  const hasPrevious = previousSnapshot !== null && previousSnapshot !== undefined;

  return {
    ok:true,
    state:"OBSERVED",
    snapshot:value,
    changed:hasPrevious ? value !== String(previousSnapshot || "") : null,
    method:observed.method,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}



/*
 * Public Computer Control geometry observation:
 *
 *   getBounds({ app, element })
 *
 * Contract:
 *   PRE:  registered application + actionable semantic @e element.
 *   POST: returns normalized accessibility bounds {x,y,w,h}.
 *
 * Coordinates are observational data. The LLM never receives authority to
 * invent or directly manipulate coordinates. Runtime operations may use these
 * deterministic bounds internally.
 */
function getBounds({app, element}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"getBounds requires an application",
      state:"FAILED",
    };
  }

  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  if (!/^@e\d+$/.test(ref)) {
    return {
      ok:false,
      error:"ACTIONABLE_ELEMENT_REQUIRED",
      detail:"getBounds requires an actionable @e element reference",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const observed = agentCtrl.getElementBounds(ref);

  if (!observed.ok || !observed.bounds) {
    return {
      ok:false,
      error:"BOUNDS_OBSERVATION_FAILED",
      detail:(observed.stderr || observed.stdout || "get bounds failed").trim(),
      state:"FAILED",
      ref,
      method:observed.method,
      observeSeconds:observed.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"OBSERVED",
    ref,
    bounds:observed.bounds,
    method:observed.method,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control semantic observation:
 *
 *   find({ app, query, role=null, first=true })
 *
 * Contract:
 *   PRE:  registered application Provider + non-empty semantic query.
 *   POST: returns backend-resolved actionable element reference(s) without
 *         exposing backend command syntax to the resolver/Skill.
 *
 * v36 uses agent-ctrl's semantic find implementation. The public contract is
 * backend-independent; another backend may implement the same operation
 * differently.
 */
function parseActionableSnapshot(snapshot) {
  const nodes = [];

  for (const raw of String(snapshot || "").split("\n")) {
    if (!raw.trim() || raw.startsWith("#")) continue;

    const m = raw.match(
      /^\s*(@e\d+)\s+([^\s]+)(?:\s+"([^"]*)")?/
    );

    if (!m) continue;

    nodes.push({
      ref:m[1],
      role:m[2] || "",
      name:m[3] || "",
      disabled:/\[disabled\]/.test(raw),
      raw,
    });
  }

  return nodes;
}

function findInSnapshot(snapshot, query, role = null, first = true) {
  const wanted = normText(query);
  const wantedRole = normText(role || "");

  if (!wanted) return null;

  let candidates = parseActionableSnapshot(snapshot)
    .filter(node => !node.disabled);

  if (wantedRole) {
    candidates = candidates.filter(
      node => normText(node.role) === wantedRole
    );
  }

  let matches = candidates.filter(
    node => node.name && normText(node.name) === wanted
  );

  let matchKind = "exact";

  if (!matches.length) {
    matches = candidates.filter(
      node => node.name && normText(node.name).includes(wanted)
    );
    matchKind = "contains";
  }

  if (!matches.length) return null;

  const selected = first ? matches.slice(0, 1) : matches;

  return {
    refs:selected.map(node => node.ref),
    nodes:selected,
    matchKind,
  };
}

/*
 * Public Computer Control semantic observation:
 *
 *   find({ app, query, role=null, first=true, snapshot=null })
 *
 * Contract:
 *   PRE:  registered application Provider + non-empty semantic query.
 *   POST: returns actionable element reference(s) through a backend-independent
 *         semantic lookup contract.
 *
 * Search order:
 *   1. normalized search over a caller-supplied observed snapshot
 *   2. backend semantic locator fallback
 *
 * The first path is intentionally generic and absorbs typography differences
 * such as Wi-Fi vs Wi‑Fi. The caller never needs to know which Unicode dash,
 * AX label spelling, or backend command syntax produced the element.
 */
function find({
  app,
  query,
  role = null,
  first = true,
  snapshot = null,
}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"find requires an application",
      state:"FAILED",
    };
  }

  const wanted = String(query || "").trim();
  if (!wanted) {
    return {
      ok:false,
      error:"QUERY_REQUIRED",
      detail:"find requires a non-empty semantic query",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  // Prefer the exact observation the caller is already reasoning about.
  // This avoids stale backend locator caches and normalizes typography at the
  // Computer Control boundary.
  if (snapshot != null) {
    const matched = findInSnapshot(snapshot, wanted, role, first);

    if (matched) {
      return {
        ok:true,
        state:"FOUND",
        query:wanted,
        role:role || null,
        ref:matched.refs[0],
        refs:matched.refs,
        method:`snapshot-normalized-${matched.matchKind}`,
        source:"snapshot",
        observeSeconds:0,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }
  }

  // Backend semantic locator remains useful when the caller has no suitable
  // snapshot or when the snapshot does not contain the target.
  const found = agentCtrl.findElement(wanted, role, first);

  if (!found.ok) {
    return {
      ok:false,
      error:"ELEMENT_NOT_FOUND",
      detail:(found.stderr || found.stdout || `No element found for "${wanted}"`).trim(),
      state:"NOT_FOUND",
      query:wanted,
      role:role || null,
      method:found.method,
      source:"backend",
      observeSeconds:found.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  const refs = String(found.stdout || "")
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => /^@e\d+$/.test(x));

  if (!refs.length) {
    return {
      ok:false,
      error:"INVALID_FIND_RESULT",
      detail:"Backend find succeeded but returned no actionable @e reference",
      state:"FAILED",
      query:wanted,
      role:role || null,
      method:found.method,
      source:"backend",
      observeSeconds:found.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  return {
    ok:true,
    state:"FOUND",
    query:wanted,
    role:role || null,
    ref:refs[0],
    refs,
    method:found.method,
    source:"backend",
    observeSeconds:found.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control API observation:
 *
 *   get({ app, element, property })
 *
 * Contract:
 *   PRE: `element.ref` is an already-resolved actionable @e element.
 *   POST: returns the requested low-level property without adding application
 *         semantics.
 *
 * v33 exposes the common text/value properties used by the current PoC.
 * Additional properties can be added to this stable operation as backend
 * coverage grows.
 */
function get({app, element, property}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"get requires an application",
      state:"FAILED",
    };
  }

  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  if (!/^@e\d+$/.test(ref)) {
    return {
      ok:false,
      error:"ACTIONABLE_ELEMENT_REQUIRED",
      detail:"get requires an actionable @e element reference",
      state:"FAILED",
    };
  }

  const prop = String(property || "").trim().toLowerCase();
  const allowed = new Set(["text", "value"]);

  if (!allowed.has(prop)) {
    return {
      ok:false,
      error:"UNSUPPORTED_PROPERTY",
      detail:`get property "${prop}" is not exposed by Computer Control v0`,
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const observed = agentCtrl.getElementProperty(ref, prop);

  if (!observed.ok) {
    return {
      ok:false,
      error:"GET_FAILED",
      detail:(observed.stderr || observed.stdout || `get ${prop} failed`).trim(),
      state:"FAILED",
      property:prop,
      ref,
      observeSeconds:observed.seconds || 0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  const raw = String(observed.stdout || "");
  const value = unquote(raw);

  return {
    ok:true,
    state:"OBSERVED",
    property:prop,
    ref,
    value,
    raw,
    method:observed.method,
    observeSeconds:observed.seconds || 0,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

function focusedEvidence(snapshot, element) {
  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  const expectedRole =
    typeof element === "object" ? normText(element?.role || "") : "";
  const expectedName =
    typeof element === "object" ? normText(element?.name || "") : "";

  for (const raw of String(snapshot || "").split("\n")) {
    if (!/\[focused\]/.test(raw)) continue;

    if (
      ref &&
      new RegExp(
        `(?:^|\\s)${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`
      ).test(raw)
    ) {
      return {verified:true, method:"snapshot-ref"};
    }

    const m = raw.match(
      /^\s*(?:(@(?:e|s)\d+)\s+)?([^\s]+)(?:\s+"([^"]*)")?/
    );
    if (!m) continue;

    const role = normText(m[2] || "");
    const name = normText(m[3] || "");

    if (
      expectedRole &&
      expectedName &&
      role === expectedRole &&
      name === expectedName
    ) {
      return {verified:true, method:"snapshot-semantic"};
    }
  }

  return {verified:false, method:"none"};
}

/*
 * Public Computer Control API operation:
 *
 *   focus({ app, element, verify=true })
 *
 * Contract:
 *   PRE:  an already-resolved actionable @e element.
 *   POST: the backend focus operation was successfully delivered.
 *
 * When the accessibility snapshot exposes [focused], the result also carries
 * independent verification evidence. Lack of that optional marker does not
 * convert a backend-confirmed focus action into a speculative failure.
 */
function focus({app, element, verify = true}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"focus requires an application",
      state:"FAILED",
    };
  }

  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  if (!/^@e\d+$/.test(ref)) {
    return {
      ok:false,
      error:"ACTIONABLE_ELEMENT_REQUIRED",
      detail:"focus requires an actionable @e element reference",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const action = agentCtrl.focusElement(ref);
  const actionSeconds = action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      error:"FOCUS_ACTION_FAILED",
      detail:(action.stderr || action.stdout || `Could not focus ${ref}`).trim(),
      state:"FAILED",
      method:"ax-focus",
      actionSeconds,
      observeSeconds:0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  let observeSeconds = 0;
  let snapshot = null;
  let evidence = {verified:false, method:verify ? "not-observed" : "disabled"};

  if (verify) {
    const observed = agentCtrl.snapshotApplication(
      providerResolved.provider,
      providerResolved.identity,
      false
    );
    observeSeconds += observed.seconds || 0;

    if (observed.ok) {
      snapshot = observed.stdout;
      evidence = focusedEvidence(snapshot, element);
    }
  }

  return {
    ok:true,
    state:evidence.verified ? "FOCUSED_VERIFIED" : "FOCUS_DELIVERED",
    error:null,
    detail:
      `focus ${ref}; method=ax-focus; verified=${evidence.verified}; ` +
      `verification=${evidence.method}`,
    method:"ax-focus",
    verified:evidence.verified,
    verificationMethod:evidence.method,
    snapshot,
    actionSeconds,
    observeSeconds,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control API operation:
 *
 *   press({ app, keys, settle=true })
 *
 * Contract:
 *   PRE:  the target application is the working/active application.
 *   POST: the requested key/chord was successfully delivered by the backend.
 *
 * Semantic consequences (new document created, search submitted, etc.) remain
 * the caller/Skill's responsibility to verify.
 */
function press({
  app,
  keys,
  settle = true,
  stableTimeoutMs = 5000,
  stablePollMs = 200,
}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"press requires an application",
      state:"FAILED",
    };
  }

  const chord = String(keys || "").trim();
  if (!chord) {
    return {
      ok:false,
      error:"KEYS_REQUIRED",
      detail:"press requires a non-empty key or chord",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  const action = agentCtrl.pressKeys(chord);
  const actionSeconds = action.seconds || 0;

  if (!action.ok) {
    return {
      ok:false,
      error:"PRESS_ACTION_FAILED",
      detail:(action.stderr || action.stdout || `Could not press ${chord}`).trim(),
      state:"FAILED",
      method:"keyboard-press",
      actionSeconds,
      observeSeconds:0,
      totalSeconds:(performance.now() - started) / 1000,
    };
  }

  let observeSeconds = 0;

  if (settle) {
    const stable = agentCtrl.waitStable(stableTimeoutMs, stablePollMs);
    observeSeconds += stable.seconds || 0;
  }

  const snapshot = agentCtrl.snapshotApplication(
    providerResolved.provider,
    providerResolved.identity,
    false
  );
  observeSeconds += snapshot.seconds || 0;

  return {
    ok:true,
    state:"DELIVERED",
    error:null,
    detail:`press "${chord}"; method=keyboard-press`,
    method:"keyboard-press",
    snapshot:snapshot.ok ? snapshot.stdout : null,
    actionSeconds,
    observeSeconds,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control API operation:
 *
 *   click({ app, element, settle=true })
 *
 * Contract:
 *   PRE:  `element.ref` identifies an actionable semantic element.
 *   POST: an activation action has been successfully delivered to that exact
 *         element when ok=true.
 *
 * Application/domain-specific effects ("pane selected", "page opened", ...)
 * are deliberately verified by the caller/Skill, not invented here.
 *
 * Backend strategy:
 *   1. native/AX click through agent-ctrl
 *   2. on the known macOS AXRaise limitation, deterministic pointer click
 *      at bounds supplied by Accessibility. No LLM coordinates are involved.
 */
function click({
  app,
  element,
  settle = true,
  stableTimeoutMs = 5000,
  stablePollMs = 200,
}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:"click requires an application",
      state:"FAILED",
    };
  }

  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  if (!/^@e\d+$/.test(ref)) {
    return {
      ok:false,
      error:"ACTIONABLE_ELEMENT_REQUIRED",
      detail:"click requires an actionable @e element reference",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  let actionSeconds = 0;
  let observeSeconds = 0;
  let method = "none";
  let fallbackUsed = false;
  let nativeError = "";
  let fallbackBounds = null;

  const native = agentCtrl.clickElement(ref);
  actionSeconds += native.seconds || 0;

  if (native.ok) {
    method = "ax-click";
  } else {
    nativeError = (native.stderr || native.stdout || "").trim();

    const knownAxRaiseLimitation =
      /focus_window/i.test(nativeError) &&
      /AXRaise failed/i.test(nativeError);

    if (!knownAxRaiseLimitation) {
      return {
        ok:false,
        error:"CLICK_ACTION_FAILED",
        detail:nativeError || `Could not click ${ref}`,
        state:"FAILED",
        method,
        fallbackUsed,
        actionSeconds,
        observeSeconds,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }

    const boundsObserved = getBounds({
      app,
      element:ref,
    });
    observeSeconds += boundsObserved.observeSeconds || 0;

    if (!boundsObserved.ok) {
      return {
        ok:false,
        error:"CLICK_BOUNDS_FAILED",
        detail:
          `native AXRaise limitation; ${boundsObserved.error}: ` +
          `${boundsObserved.detail || "bounds unavailable"}`,
        state:"FAILED",
        method,
        fallbackUsed:true,
        boundsObserved:false,
        actionSeconds,
        observeSeconds,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }

    fallbackBounds = boundsObserved.bounds;

    const fallback = agentCtrl.pointerClickElement(
      ref,
      app,
      fallbackBounds
    );
    actionSeconds += fallback.seconds || 0;

    if (!fallback.ok) {
      return {
        ok:false,
        error:"CLICK_FALLBACK_FAILED",
        detail:
          `native AXRaise limitation; ` +
          `${fallback.stderr || fallback.summary || "pointer fallback failed"}`,
        state:"FAILED",
        method,
        fallbackUsed:true,
        actionSeconds,
        observeSeconds,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }

    method = "ax-bounds-pointer";
    fallbackUsed = true;
  }

  if (settle) {
    const stable = agentCtrl.waitStable(stableTimeoutMs, stablePollMs);
    observeSeconds += stable.seconds || 0;
  }

  const snapshot = agentCtrl.snapshotApplication(
    providerResolved.provider,
    providerResolved.identity,
    false
  );
  observeSeconds += snapshot.seconds || 0;

  return {
    ok:true,
    state:"ACTIVATED",
    error:null,
    detail:
      `click ${ref}; method=${method}; fallback=${fallbackUsed}` +
      (fallbackBounds
        ? `; boundsObserved=true; bounds=` +
          `${fallbackBounds.x},${fallbackBounds.y},${fallbackBounds.w},${fallbackBounds.h}`
        : `; boundsObserved=${fallbackUsed ? "false" : "not-needed"}`) +
      (nativeError ? `; native-error=${nativeError}` : ""),
    method,
    fallbackUsed,
    boundsObserved:fallbackBounds !== null,
    bounds:fallbackBounds,
    snapshot:snapshot.ok ? snapshot.stdout : null,
    actionSeconds,
    observeSeconds,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Internal exact replacement engine shared by public setText() and clear().
 * The public operations keep distinct semantics while backend strategy and
 * postcondition mechanics remain centralized here.
 */
function replaceText({app, element, text, verify = true, operation = "setText", allowEmpty = false}) {
  const started = performance.now();

  if (!app) {
    return {
      ok:false,
      error:"APP_REQUIRED",
      detail:`${operation} requires an application`,
      state:"FAILED",
    };
  }

  const ref =
    typeof element === "string"
      ? element
      : String(element?.ref || "").trim();

  if (!/^@e\d+$/.test(ref)) {
    return {
      ok:false,
      error:"EDITABLE_ELEMENT_REQUIRED",
      detail:`${operation} requires an actionable @e element reference`,
      state:"FAILED",
    };
  }

  const requested = text == null ? "" : String(text);

  if (!allowEmpty && requested.length === 0) {
    return {
      ok:false,
      error:"EMPTY_TEXT_REQUIRES_CLEAR",
      detail:"setText does not encode clear semantics; use clear()",
      state:"FAILED",
    };
  }

  const providerResolved = resolveProviderIdentity(app);
  if (!providerResolved.ok) {
    return {
      ok:false,
      error:providerResolved.error,
      detail:providerResolved.detail,
      state:"FAILED",
    };
  }

  let actionSeconds = 0;
  let observeSeconds = 0;
  let lastError = "";
  let lastSnapshot = null;
  const attempts = [];

  const strategies = operation === "clear"
    ? [
        {
          method:"ax-fill-empty",
          act:() => agentCtrl.fillElement(ref, ""),
        },
        {
          method:"focus+select-all+backspace",
          act:() => clearFocusedValueByDelete(ref),
        },
        {
          method:"focus+select-all+clipboard-paste-empty",
          act:() => replaceFocusedValueByClipboard(ref, ""),
        },
      ]
    : [
        {
          method:"ax-fill",
          act:() => agentCtrl.fillElement(ref, requested),
        },
        {
          method:"focus+select-all+clipboard-paste",
          act:() => replaceFocusedValueByClipboard(ref, requested),
        },
        {
          method:"focus+select-all+type",
          act:() => replaceFocusedValueByTyping(ref, requested),
        },
      ];

  for (const strategy of strategies) {
    const action = strategy.act();
    actionSeconds += action.seconds || 0;

    if (!action.ok) {
      lastError = action.error || action.stderr || action.stdout || "action failed";
      attempts.push({
        method:strategy.method,
        action:"FAILED",
        verified:false,
        verification:"none",
      });
      continue;
    }

    if (!verify) {
      return {
        ok:true,
        state:operation === "clear" ? "CLEARED" : "SET",
        method:strategy.method,
        verified:false,
        verificationMethod:"disabled",
        attempts,
        actionSeconds,
        observeSeconds,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }

    const stable = agentCtrl.waitStable(5000, 200);
    observeSeconds += stable.seconds || 0;

    const verification = verifyExactTextPostcondition(
      providerResolved,
      ref,
      requested
    );
    observeSeconds += verification.seconds || 0;
    if (verification.snapshot) lastSnapshot = verification.snapshot;

    attempts.push({
      method:strategy.method,
      action:"DELIVERED",
      verified:verification.ok,
      verification:verification.method,
    });

    if (verification.ok) {
      return {
        ok:true,
        state:"VERIFIED",
        error:null,
        detail:
          `${operation} ${ref}; method=${strategy.method}; ` +
          `verification=${verification.method}; strategies=${attempts.length}`,
        method:strategy.method,
        verified:true,
        verificationMethod:verification.method,
        observed:verification.observed || "",
        snapshot:lastSnapshot,
        attempts,
        actionSeconds,
        observeSeconds,
        totalSeconds:(performance.now() - started) / 1000,
      };
    }

    // Core v31 rule: backend success without verified postcondition is not
    // operation success. Continue with the next deterministic strategy.
    lastError =
      `postcondition not verified after ${strategy.method}`;
  }

  // Capture a final snapshot for diagnostics, but do not reinterpret it as
  // success unless it was tied to the exact element by verification above.
  if (!lastSnapshot) {
    const snapshot = agentCtrl.snapshotApplication(
      providerResolved.provider,
      providerResolved.identity,
      false
    );
    observeSeconds += snapshot.seconds || 0;
    if (snapshot.ok) lastSnapshot = snapshot.stdout;
  }

  return {
    ok:false,
    state:"UNVERIFIED",
    error:operation === "clear" ? "CLEAR_VERIFICATION_FAILED" : "SET_TEXT_VERIFICATION_FAILED",
    detail:
      `All deterministic ${operation} strategies exhausted for ${ref}; ` +
      `${lastError || "requested text was not verified"}`,
    method:attempts.length ? attempts[attempts.length - 1].method : "none",
    verified:false,
    verificationMethod:"none",
    observed:"",
    snapshot:lastSnapshot,
    attempts,
    actionSeconds,
    observeSeconds,
    totalSeconds:(performance.now() - started) / 1000,
  };
}

/*
 * Public Computer Control API operation:
 *
 *   setText({ app, element, text, verify=true })
 *
 * Contract:
 *   PRE:  `element.ref` identifies an actionable editable surface and text is
 *         non-empty.
 *   POST: surface value equals requested text exactly when ok=true.
 */
function setText({app, element, text, verify = true}) {
  return replaceText({
    app,
    element,
    text,
    verify,
    operation:"setText",
    allowEmpty:false,
  });
}

/*
 * Public Computer Control API operation:
 *
 *   clear({ app, element, verify=true })
 *
 * Contract:
 *   PRE:  `element.ref` identifies an actionable editable surface.
 *   POST: surface value equals the empty string exactly when ok=true.
 *
 * Empty text is intentionally not overloaded onto setText(). clear() carries
 * explicit erase semantics and is independently verifiable/idempotent.
 */
function clear({app, element, verify = true}) {
  return replaceText({
    app,
    element,
    text:"",
    verify,
    operation:"clear",
    allowEmpty:true,
  });
}

module.exports = {
  normText,
  getForeground,
  waitStable,
  getCurrentWindow,
  snapshot,
  getBounds,
  find,
  get,
  focus,
  press,
  click,
  setText,
  clear,
};
