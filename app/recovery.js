"use strict";

const {
  press,
  click,
  focus,
  setText,
  snapshot,
  waitUntilChanged,
  waitStable,
} = require("./computer-control-external");
const {
  snapshotForModel,
  parseSnapshot,
  resolveSemanticTarget,
  isInsideChrome,
} = require("./semantic-ui");
const { askOllama, parseModelJson } = require("./llm");

function executeRecoveryPrimitive(decision, snapshot, currentApp) {
  const { action, target, role, text, keys } = decision;

  if (!currentApp) {
    return {
      ok:false,
      summary:"Rejected: recovery requires an active application.",
      seconds:0,
    };
  }

  if (action === "PRESS") {
    if (!keys) {
      return {
        ok:false,
        summary:"Rejected: PRESS requires keys.",
        seconds:0,
      };
    }

    const result = press({
      app:currentApp,
      keys,
      settle:false,
    });

    return {
      ok:result.ok,
      summary:result.ok
        ? `computer-control.press "${keys}"; method=${result.method}`
        : `${result.error}: ${result.detail || "press failed"}`,
      seconds:result.actionSeconds || 0,
      observeSeconds:result.observeSeconds || 0,
      method:result.method || "none",
    };
  }

  if (!["CLICK", "FOCUS", "FILL"].includes(action)) {
    return {
      ok:false,
      summary:`Rejected: unsupported recovery action ${action}`,
      seconds:0,
    };
  }

  if (action === "FILL" && text == null) {
    return {
      ok:false,
      summary:"Rejected: FILL requires text.",
      seconds:0,
    };
  }

  const resolved = resolveSemanticTarget(
    snapshot,
    target,
    role,
    action,
    currentApp
  );

  if (!resolved.ok) {
    return {
      ok:false,
      summary:`Rejected: ${resolved.error}`,
      seconds:0,
    };
  }

  if (action === "CLICK") {
    const result = click({
      app:currentApp,
      element:resolved,
      settle:false,
    });

    return {
      ok:result.ok,
      summary:
        `target="${target}" -> ${resolved.ref} ${resolved.role}` +
        (resolved.promoted
          ? ` (matched ${resolved.matchedRef} ${resolved.matchedRole}; promoted to parent)`
          : "") +
        ` | computer-control.click method=${result.method || "none"}; ` +
        `fallback=${Boolean(result.fallbackUsed)}` +
        (result.ok ? "" : `; ${result.error}: ${result.detail || ""}`),
      seconds:result.actionSeconds || 0,
      observeSeconds:result.observeSeconds || 0,
      method:result.method || "none",
      fallbackUsed:Boolean(result.fallbackUsed),
    };
  }

  if (action === "FOCUS") {
    const result = focus({
      app:currentApp,
      element:resolved,
      verify:true,
    });

    return {
      ok:result.ok,
      summary:
        `target="${target}" -> ${resolved.ref} ${resolved.role}` +
        ` | computer-control.focus method=${result.method || "none"}; ` +
        `verified=${Boolean(result.verified)}` +
        (result.ok ? "" : `; ${result.error}: ${result.detail || ""}`),
      seconds:result.actionSeconds || 0,
      observeSeconds:result.observeSeconds || 0,
      method:result.method || "none",
      verified:Boolean(result.verified),
    };
  }

  const result = setText({
    app:currentApp,
    element:resolved,
    text,
    verify:true,
  });

  return {
    ok:result.ok,
    summary:
      `target="${target}" -> ${resolved.ref} ${resolved.role}` +
      ` | computer-control.setText method=${result.method || "none"}; ` +
      `verified=${Boolean(result.verified)}` +
      (result.ok ? "" : `; ${result.error}: ${result.detail || ""}`),
    seconds:result.actionSeconds || 0,
    observeSeconds:result.observeSeconds || 0,
    method:result.method || "none",
    verified:Boolean(result.verified),
  };
}

function recoveryView(snapshot) {
  const nodes = parseSnapshot(snapshot);

  const interestingRoles = new Set([
    "window", "dialog", "sheet", "group", "button", "link",
    "checkbox", "radio", "menu-item", "text-field", "search-box",
    "region", "static-text"
  ]);

  const consentTerms =
    /\b(cookie|cookies|privacy|consent|tracking|tracker|personalized|personalised|advertising|ads|accetta|accetto|rifiuta|rifiuto|solo necessari|necessari|non essenziali|continua|reject|decline|accept|necessary|essential|agree|allow|manage|preferences|preferenze)\b/i;

  const lines = [];
  for (const n of nodes) {
    if (!interestingRoles.has(n.role)) continue;

    const raw = n.raw || "";
    const text = n.name || "";

    if (
      n.ref?.startsWith("@e") ||
      n.role === "dialog" ||
      n.role === "sheet" ||
      consentTerms.test(text) ||
      consentTerms.test(raw)
    ) {
      const flags = [
        n.disabled ? "disabled" : "",
        n.selected ? "selected" : "",
        n.focused ? "focused" : "",
      ].filter(Boolean).join(",");

      lines.push(
        `${n.ref || "-"} ${n.role}` +
        `${text ? ` "${text}"` : ""}` +
        `${flags ? ` [${flags}]` : ""}`
      );
    }
  }

  // Avoid feeding the small model hundreds of unrelated AX lines.
  return lines.slice(0, 140).join("\n");
}

function consentLikeSnapshot(snapshot) {
  return /\b(cookie|cookies|privacy|consent|tracking|accetta|rifiuta|necessari|non essenziali|reject|decline|accept|necessary|essential|agree|allow)\b/i
    .test(snapshotForModel(snapshot));
}

function semanticRecoveryCandidates(snapshot) {
  const nodes = parseSnapshot(snapshot).filter(n =>
    n.ref &&
    n.ref.startsWith("@e") &&
    !n.disabled &&
    n.name
  );

  const actionable = new Set([
    "button", "link", "checkbox", "radio", "menu-item", "cell", "region"
  ]);

  return nodes
    .filter(n => actionable.has(n.role))
    .map(n => ({
      ref:n.ref,
      role:n.role,
      name:n.name,
      selected:n.selected,
      focused:n.focused
    }));
}

function leastPermissionConsentCandidate(snapshot) {
  const candidates = semanticRecoveryCandidates(snapshot);

  const preferred = [
    /\b(reject all|reject|decline|deny|refuse)\b/i,
    /\b(rifiuta tutto|rifiuta|rifiuto|nega)\b/i,
    /\b(only necessary|necessary only|essential only|use necessary|continue without accepting)\b/i,
    /\b(solo necessari|solo essenziali|necessari|non essenziali|continua senza accettare)\b/i,
  ];

  for (const rx of preferred) {
    const found = candidates.find(c => rx.test(c.name));
    if (found) return found;
  }

  return null;
}

async function decideRecovery(intent, failure, state, recoveryHistory = []) {
  const compact = recoveryView(state.snapshot);
  const consentDetected = consentLikeSnapshot(state.snapshot);
  const deterministicConsent = consentDetected
    ? leastPermissionConsentCandidate(state.snapshot)
    : null;

  // If a clear least-permission consent control is already visible, do not
  // spend another LLM call guessing. This is generic consent handling based on
  // semantic labels, not a Google-specific rule.
  if (deterministicConsent) {
    return {
      action:"CLICK",
      target:deterministicConsent.name,
      role:deterministicConsent.role,
      text:null,
      keys:null,
      reason:"visible least-permission consent option",
      seconds:0,
      deterministic:true
    };
  }

  const prompt = `You are a recovery module for a macOS computer-use agent.

The main plan is FIXED. An intent failed because the UI contains an unexpected
state or blocker. Choose at most ONE corrective action that removes the blocker
so the SAME failed intent can be retried.

FAILED INTENT:
${JSON.stringify(intent)}

FAILURE:
${failure?.error || "unknown failure"}

DETAIL:
${failure?.detail || "(none)"}

CURRENT APP:
${state.currentApp || "(none)"}

RECOVERY-RELEVANT UI:
${compact || "(no obvious recovery controls found)"}

PREVIOUS RECOVERY ATTEMPTS FOR THIS INTENT:
${recoveryHistory.length ? recoveryHistory.join("\n") : "(none)"}

ALLOWED RECOVERY ACTIONS:
- CLICK: click a visible semantic target.
- FOCUS: focus a visible editable target.
- FILL: fill a visible editable target.
- PRESS: press one key/chord.
- NO_RECOVERY: no safe/obvious corrective action exists.

RULES:
1. Do NOT change, replace, skip, or advance the failed intent.
2. Only remove an obvious blocker: modal, dialog, consent screen, popup,
   overlay, interstitial, or equivalent UI state.
3. NEVER repeat a recovery action listed in PREVIOUS RECOVERY ATTEMPTS.
4. If a consent/privacy screen exposes actionable buttons or links, prefer
   CLICK on an explicit semantic control over pressing Escape.
5. For consent/privacy choices that allow equivalent continuation, prefer:
   reject / decline / necessary-only / non-essential-disabled
   over accept-all.
6. Use ESC only when there is no visible actionable control that can dismiss
   or resolve the blocker.
7. Never output @eN/@sN refs. Use visible semantic labels.
8. Do not dismiss security warnings or grant OS permissions automatically.
9. If no safe and obvious NEW recovery exists, return NO_RECOVERY.
10. Return JSON only.

Schema:
{"action":"CLICK|FOCUS|FILL|PRESS|NO_RECOVERY","target":"visible label or null","role":"optional role or null","text":"string or null","keys":"string or null","reason":"very short"}`;

  const r = await askOllama(
    prompt,
    "Return one NEW safe corrective UI action, or NO_RECOVERY. Prefer explicit semantic controls over Escape.",
    190
  );

  const raw = parseModelJson(r.content);
  return {
    action: String(raw?.action || "NO_RECOVERY").trim().toUpperCase(),
    target: raw?.target == null ? null : String(raw.target).trim(),
    role: raw?.role == null ? null : String(raw.role).trim().toLowerCase(),
    text: raw?.text == null ? null : String(raw.text),
    keys: raw?.keys == null ? null : String(raw.keys),
    reason: raw?.reason == null ? "" : String(raw.reason),
    seconds: r.seconds,
    deterministic:false
  };
}

async function executeRecoveryAction(recovery, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"recovery requires current application state"};
  }

  if (recovery.action === "NO_RECOVERY") {
    return {ok:false, noRecovery:true, error:"recovery model found no safe corrective action"};
  }

  const decision = {
    action: recovery.action,
    target: recovery.target,
    role: recovery.role,
    text: recovery.text,
    keys: recovery.keys,
    app: null,
    reason: recovery.reason,
  };

  const actionResult = executeRecoveryPrimitive(decision, state.snapshot, state.currentApp);
  if (!actionResult.ok) {
    return {
      ok:false,
      error:`recovery action failed: ${actionResult.summary}`,
      detail:actionResult.summary
    };
  }

  // Synchronize mechanically before retrying the original intent.
  // A recovery FOCUS may be useful without changing the whole snapshot, so
  // generic recovery requires stability, not an arbitrary "changed" condition.
  const stable = waitStable({
    app:state.currentApp,
    timeoutMs:7000,
    pollMs:200,
  });

  if (!stable.ok) {
    return {
      ok:false,
      error:`recovery synchronization failed: ${stable.error}: ${stable.detail || ""}`,
      detail:actionResult.summary,
    };
  }

  const nextSnapshot = stable.snapshot || state.snapshot;
  const changed = nextSnapshot !== state.snapshot;

  return {
    ok:true,
    currentApp:state.currentApp,
    snapshot:nextSnapshot,
    changed,
    actionSeconds:actionResult.seconds,
    observeSeconds:
      (actionResult.observeSeconds || 0) +
      (stable.waitSeconds || 0) +
      (stable.observeSeconds || 0),
    detail:
      `${recovery.action} target="${recovery.target || ""}"` +
      `; reason="${recovery.reason || ""}"` +
      `; ${actionResult.summary}; sync=stable; changed=${changed}`
  };
}

function strongBlockerEvidence(snapshot) {
  const nodes = parseSnapshot(snapshot);

  // Structural blocker evidence.
  if (nodes.some(n => n.role === "dialog" || n.role === "sheet")) {
    return {blocked:true, reason:"dialog/sheet present"};
  }

  // Strong semantic controls that normally belong to consent/interstitial UI.
  // We intentionally do NOT trigger merely on generic words such as
  // "privacy", "settings", or "sign in".
  const blockerControl = nodes.find(n =>
    n.ref &&
    n.ref.startsWith("@e") &&
    !n.disabled &&
    n.name &&
    ["button", "link", "checkbox", "radio"].includes(n.role) &&
    /\b(reject\s+all|reject|decline|deny|rifiuta\s+tutto|rifiuta|nega|accept\s+all|accept\s+cookies|agree|accetta\s+tutto|accetta|only\s+necessary|necessary\s+only|essential\s+only|solo\s+necessari|solo\s+essenziali|continue\s+without\s+accepting|continua\s+senza\s+accettare)\b/i.test(n.name)
  );

  if (blockerControl) {
    return {
      blocked:true,
      reason:`strong blocker control: ${blockerControl.role} "${blockerControl.name}"`
    };
  }

  return {blocked:false, reason:"no strong blocker evidence"};
}

function locatorCandidates(snapshot) {
  const nodes = parseSnapshot(snapshot);

  const candidateRoles = new Set([
    "link", "button", "cell", "region"
  ]);

  const genericNoise =
    /^(settings|impostazioni|sign in|accedi|login|privacy|terms|termini|help|aiuto|images|immagini|news|notizie|maps|mappe|videos|video|shopping|more|altro|tools|strumenti)$/i;

  const out = [];

  for (const n of nodes) {
    if (
      !n.ref ||
      !n.ref.startsWith("@e") ||
      n.disabled ||
      !n.name ||
      !candidateRoles.has(n.role) ||
      isInsideChrome(n)
    ) continue;

    // Do not delete all generic page controls; just mark obvious noise so the
    // locator has a cleaner first-pass candidate set.
    if (genericNoise.test(n.name.trim())) continue;

    out.push({
      ref:n.ref,
      role:n.role,
      name:n.name,
      selected:n.selected,
      focused:n.focused,
      node:n
    });
  }

  return out.slice(0, 120);
}

async function locateOrdinalResult(intent, state) {
  const index = Number.isFinite(Number(intent.index)) && Number(intent.index) >= 1
    ? Number(intent.index)
    : 1;

  let locatorSnapshot = state.snapshot;
  let observationDepth = "compact";
  let observationMethod = "existing-state";
  let observationSeconds = 0;
  let candidates = locatorCandidates(locatorSnapshot);

  // The agent loop calls the result locator only after it has established that
  // the current compact state contains no strong blocker. If compact
  // observation is insufficient to expose page content, escalate observation
  // depth generically instead of guessing an application-specific workaround.
  if (!candidates.length) {
    const full = snapshot({
      app:state.currentApp,
      compact:false,
      settle:false,
    });

    observationSeconds += full.observeSeconds || 0;

    if (full.ok) {
      locatorSnapshot = full.snapshot;
      observationDepth = "full";
      observationMethod = full.method || "computer-control.snapshot";
      candidates = locatorCandidates(locatorSnapshot);
    } else {
      return {
        ok:false,
        error:
          `semantic result locator compact observation found no candidates; ` +
          `full observation failed: ${full.error}: ${full.detail || ""}`,
        detail:
          `observationDepth=compact->full; compactCandidates=0; fullSnapshot=false`
      };
    }
  }

  if (!candidates.length) {
    return {
      ok:false,
      code:"SURFACE_NOT_OBSERVABLE",
      error:
        "no actionable result surface observed at full accessibility depth",
      detail:
        `observationDepth=${observationDepth}; ` +
        `observationMethod=${observationMethod}; candidates=0; ` +
        `capability=result-content.observe`
    };
  }

  const candidateText = candidates.map((c, i) =>
    `C${i + 1} ${c.role} "${c.name}"`
  ).join("\n");

  const prompt = `You are a semantic locator inside a search-results page.

The main task requires opening ordinal search result ${index}.
Choose the candidate that represents the ${index === 1 ? "first" : `#${index}`}
actual search-result destination.

CURRENT APP:
${state.currentApp}

PAGE CONTENT CANDIDATES IN ACCESSIBILITY ORDER:
${candidateText}

RULES:
1. Return exactly one candidate id such as C7.
2. Choose an actual result destination/content item, not browser/site chrome.
3. Ignore account controls, settings, sign-in/login, privacy/terms, search
   filters, navigation categories, cookie controls, and generic page controls.
4. Do not choose a control merely because its text resembles the search query.
5. Respect the requested ordinal among real result destinations.
6. If no candidate can reasonably be identified as a search result, return NONE.
7. Return JSON only.

Schema:
{"candidate":"C<number>|NONE","reason":"very short"}`;

  const r = await askOllama(
    prompt,
    "Select one actual search-result candidate from the provided semantic candidate list, or NONE.",
    160
  );

  const raw = parseModelJson(r.content);
  const choice = String(raw?.candidate || "NONE").trim().toUpperCase();

  if (choice === "NONE") {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:"result locator returned NONE",
      detail:raw?.reason || ""
    };
  }

  const m = choice.match(/^C(\d+)$/);
  if (!m) {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:`invalid locator candidate "${choice}"`
    };
  }

  const ci = Number(m[1]) - 1;
  if (ci < 0 || ci >= candidates.length) {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:`locator candidate out of range: ${choice}`
    };
  }

  const chosen = candidates[ci];

  // For child text regions inside list/cell structures, promote using the same
  // generic rule used by the normal semantic resolver.
  let clickNode = chosen.node;
  if (!["button", "link", "cell"].includes(clickNode.role)) {
    let p = clickNode.parent;
    while (p) {
      if (
        p.ref &&
        p.ref.startsWith("@e") &&
        !p.disabled &&
        (p.role === "cell" || p.role === "row")
      ) {
        clickNode = p;
        break;
      }
      p = p.parent;
    }
  }

  const clicked = click({
    app:state.currentApp,
    element:clickNode,
    settle:false,
  });

  if (!clicked.ok) {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:`locator click failed: ${clicked.error}: ${clicked.detail || ""}`
    };
  }

  const changed = await waitUntilChanged(
    state.currentApp,
    locatorSnapshot,
    {
      timeoutMs:7000,
      pollMs:200,
      compact:observationDepth !== "full",
    }
  );

  if (!changed.ok) {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:`locator synchronization failed: ${changed.error}: ${changed.detail || ""}`
    };
  }

  const stable = waitStable({
    app:state.currentApp,
    timeoutMs:7000,
    pollMs:200,
  });

  if (!stable.ok) {
    return {
      ok:false,
      inferenceSeconds:r.seconds,
      error:`locator stability failed: ${stable.error}: ${stable.detail || ""}`
    };
  }

  return {
    ok:true,
    inferenceSeconds:r.seconds,
    currentApp:state.currentApp,
    snapshot:stable.snapshot || changed.snapshot,
    changed:true,
    actionSeconds:clicked.actionSeconds || 0,
    observeSeconds:
      observationSeconds +
      (clicked.observeSeconds || 0) +
      (changed.observeSeconds || 0) +
      (stable.waitSeconds || 0) +
      (stable.observeSeconds || 0),
    detail:
      `${choice} -> ${chosen.ref} ${chosen.role} "${chosen.name}"` +
      `${clickNode.ref !== chosen.ref ? ` -> promoted ${clickNode.ref} ${clickNode.role}` : ""}` +
      `; observationDepth=${observationDepth}; ` +
      `observationMethod=${observationMethod}; candidates=${candidates.length}; ` +
      `computer-control.click method=${clicked.method}; ` +
      `fallback=${Boolean(clicked.fallbackUsed)}; ` +
      `sync=changed+stable; syncCompact=${observationDepth !== "full"}; ` +
      `changedAttempts=${changed.attempts || 0}; ` +
      `reason="${raw?.reason || ""}"; ${clicked.detail || ""}`,
    error:null
  };
}

module.exports = {
  executeRecoveryPrimitive,
  recoveryView,
  consentLikeSnapshot,
  semanticRecoveryCandidates,
  leastPermissionConsentCandidate,
  decideRecovery,
  executeRecoveryAction,
  strongBlockerEvidence,
  locatorCandidates,
  locateOrdinalResult,
};
