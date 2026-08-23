"use strict";

const { applicationSpec } = require("./provider-manager");
const {
  snapshotForModel,
  parseSnapshot,
  normText,
  resolveSemanticTarget,
  findEditableControl,
  findSearchControl,
  semanticTargetSelected,
  resultCandidates,
} = require("./semantic-ui");
const { ensureReady, waitUntilSnapshotCondition, waitUntilChanged, waitStable, getCurrentWindow, snapshot, get, focus, press, click, setText, clear } = require("./computer-control");

async function observeKnownApp(currentApp, previousSnapshot = "") {
  const observed = snapshot({
    app:currentApp,
    previousSnapshot,
  });

  if (!observed.ok) {
    throw new Error(
      `${observed.error}: ${observed.detail || "application snapshot failed"}`
    );
  }

  return {
    snapshot:observed.snapshot,
    changed:observed.changed,
    seconds:observed.observeSeconds || 0,
  };
}

async function executeActivateIntent(intent, state) {
  const desired = applicationSpec(intent.app).process;
  if (!desired) {
    return {ok:false, error:"ACTIVATE_APP has no app"};
  }

  const ready = await ensureReady(desired);

  if (!ready.ok) {
    return {
      ok:false,
      error:`${ready.error}: ${ready.detail || "application did not become ready"}`,
      detail:ready.diagnostics
        ? `computer-control diagnostics=${JSON.stringify(ready.diagnostics)}`
        : null,
    };
  }

  return {
    ok:true,
    currentApp:ready.currentApp || desired,
    snapshot:ready.snapshot,
    changed:true,
    actionSeconds:ready.actionSeconds,
    observeSeconds:ready.observeSeconds,
    detail:ready.detail,
  };
}

async function executeSearchIntent(intent, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"SEARCH requires an active application snapshot"};
  }

  const query = String(intent.query || "").trim();
  if (!query) return {ok:false, error:"SEARCH has no query"};

  const control = findSearchControl(state.snapshot);
  if (!control) {
    return {ok:false, error:"no semantic search/editable control found"};
  }

  const written = setText({
    app:state.currentApp,
    element:control,
    text:query,
    verify:true,
  });

  if (!written.ok) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:`SEARCH setText failed: ${written.error}: ${written.detail || ""}`,
      detail:`setText attempts=${JSON.stringify(written.attempts || [])}`
    };
  }

  let submitUsed = false;
  let submitDetail = "";
  let actionSeconds = written.actionSeconds || 0;
  let computerControlObserveSeconds = written.observeSeconds || 0;

  // Semantics:
  // - AX search-box controls commonly expose live/dynamic search (e.g. System Settings)
  // - search/address text-fields commonly require an explicit submit (e.g. browser smart field)
  //
  // This rule is based on the control semantics, not on a Safari-specific branch.
  const looksLikeSubmitSearchField =
    control.role === "text-field" &&
    /\b(search|ricerca|cerca|smart|address|indirizz)/i.test(control.name || "");

  if (looksLikeSubmitSearchField) {
    const focused = focus({
      app:state.currentApp,
      element:control,
      verify:true,
    });
    actionSeconds += focused.actionSeconds || 0;
    computerControlObserveSeconds += focused.observeSeconds || 0;

    if (!focused.ok) {
      return {
        ok:false,
        error:`SEARCH set query but could not focus ${control.ref}: ${focused.error}: ${focused.detail || ""}`
      };
    }

    const submitted = press({
      app:state.currentApp,
      keys:"Enter",
      settle:false,
    });
    actionSeconds += submitted.actionSeconds || 0;
    computerControlObserveSeconds += submitted.observeSeconds || 0;

    if (!submitted.ok) {
      return {
        ok:false,
        error:`SEARCH set query but Enter submit failed: ${submitted.error}: ${submitted.detail || ""}`
      };
    }

    submitUsed = true;
    submitDetail =
      `computer-control focus(verified=${focused.verified}) + press(Enter)`;
  }

  const changed = await waitUntilChanged(
    state.currentApp,
    state.snapshot,
    {timeoutMs:7000, pollMs:200}
  );

  if (!changed.ok) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:`SEARCH synchronization failed: ${changed.error}: ${changed.detail || ""}`,
      detail:changed.diagnostics
        ? `synchronization diagnostics=${JSON.stringify(changed.diagnostics)}`
        : null,
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
      recoveryPolicy:"NONE",
      error:`SEARCH stability failed: ${stable.error}: ${stable.detail || ""}`,
    };
  }

  const observed = {
    snapshot:stable.snapshot || changed.snapshot,
    changed:true,
    seconds:
      (changed.observeSeconds || 0) +
      (stable.waitSeconds || 0) +
      (stable.observeSeconds || 0),
  };

  const refreshedControl = findSearchControl(observed.snapshot);
  let value = "";
  let getTextOk = false;
  let getTextMethod = "none";

  if (refreshedControl) {
    const got = get({
      app:state.currentApp,
      element:refreshedControl,
      property:"text",
    });

    getTextOk = got.ok;
    getTextMethod = got.method || (got.ok ? "computer-control.get" : "failed");

    if (got.ok) {
      value = got.value;
    }
  }

  const queryVisible =
    normText(value).includes(normText(query)) ||
    normText(snapshotForModel(observed.snapshot)).includes(normText(query));

  const verified = observed.changed && queryVisible;

  return {
    ok:verified,
    currentApp:state.currentApp,
    snapshot:observed.snapshot,
    changed:observed.changed,
    actionSeconds,
    waitSeconds:(changed.waitSeconds || 0) + (stable.waitSeconds || 0),
    observeSeconds:observed.seconds + computerControlObserveSeconds,
    detail:
      `search-control=${control.ref} ${control.role} "${control.name || ""}"; ` +
      `setText="${query}" method=${written.method} verification=${written.verificationMethod} ` +
      `strategies=${JSON.stringify(written.attempts || [])}; ` +
      `submit=${submitUsed ? submitDetail : "dynamic"}; ` +
      `sync=changed+stable; changedAttempts=${changed.attempts || 0}; ` +
      `getTextOk=${getTextOk}; getTextMethod=${getTextMethod}; ` +
      `changed=${observed.changed}; queryVisible=${queryVisible}`,
    error:verified ? null : "SEARCH verification failed"
  };
}



async function executeOpenResultIntent(intent, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"OPEN_RESULT requires an active application snapshot"};
  }

  const index = Number.isFinite(Number(intent.index)) && Number(intent.index) >= 1
    ? Number(intent.index)
    : 1;

  const candidates = resultCandidates(state.snapshot);

  if (candidates.length < index) {
    const preview = candidates.slice(0, 8).map((n, i) =>
      `${i + 1}:${n.ref}:${n.role}:"${n.name}"`
    ).join(", ");

    return {
      ok:false,
      error:`OPEN_RESULT ${index}: only ${candidates.length} result candidate(s) found`,
      detail:`candidates=[${preview}]`
    };
  }

  const chosen = candidates[index - 1];
  const before = state.snapshot;

  const clicked = click({
    app:state.currentApp,
    element:chosen,
    settle:false,
  });

  if (!clicked.ok) {
    return {
      ok:false,
      error:`OPEN_RESULT click failed: ${clicked.error}: ${clicked.detail || ""}`
    };
  }

  const actionSeconds = clicked.actionSeconds || 0;
  const fallbackUsed = clicked.fallbackUsed;
  const actionDetail = clicked.detail;

  const changed = await waitUntilChanged(
    state.currentApp,
    before,
    {timeoutMs:7000, pollMs:200}
  );

  if (!changed.ok) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:`OPEN_RESULT synchronization failed: ${changed.error}: ${changed.detail || ""}`,
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
      recoveryPolicy:"NONE",
      error:`OPEN_RESULT stability failed: ${stable.error}: ${stable.detail || ""}`,
    };
  }

  const observed = {
    snapshot:stable.snapshot || changed.snapshot,
    changed:true,
    seconds:
      (changed.observeSeconds || 0) +
      (stable.waitSeconds || 0) +
      (stable.observeSeconds || 0),
  };

  const verified = true;

  return {
    ok:verified,
    currentApp:state.currentApp,
    snapshot:observed.snapshot,
    changed:observed.changed,
    actionSeconds,
    observeSeconds:observed.seconds,
    detail:
      `result-index=${index}; chosen=${chosen.ref} ${chosen.role} "${chosen.name}"; ` +
      `fallback=${fallbackUsed}; sync=changed+stable; ` +
      `changedAttempts=${changed.attempts || 0}; changed=${observed.changed}; ${actionDetail}`,
    error:verified ? null : "OPEN_RESULT verification failed: UI did not change"
  };
}

async function executeOpenIntent(intent, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"OPEN requires an active application snapshot"};
  }

  const target = String(intent.target || "").trim();
  if (!target) return {ok:false, error:"OPEN has no target"};

  const resolved = resolveSemanticTarget(state.snapshot, target, null, "CLICK", state.currentApp);
  if (!resolved.ok) {
    return {ok:false, error:`target resolution failed: ${resolved.error}`};
  }

  const clicked = click({
    app:state.currentApp,
    element:resolved,
    stableTimeoutMs:5000,
    stablePollMs:200,
  });

  if (!clicked.ok) {
    return {
      ok:false,
      error:`OPEN click failed: ${clicked.error}: ${clicked.detail || ""}`
    };
  }

  const actionSeconds = clicked.actionSeconds || 0;
  const fallbackUsed = clicked.fallbackUsed;
  const actionDetail = clicked.detail;

  let observed;
  try {
    observed = await observeKnownApp(state.currentApp, state.snapshot);
  } catch (e) {
    return {ok:false, error:`post-OPEN snapshot failed: ${e.message}`};
  }

  const currentWindow = getCurrentWindow({
    app:state.currentApp,
  });

  const titleMatches =
    currentWindow.ok &&
    normText(currentWindow.window?.title).includes(normText(target));

  const selected = semanticTargetSelected(observed.snapshot, target);

  // For general navigation we require semantic evidence stronger than merely
  // "the label is still visible". Either it became selected or the window title
  // reflects the target.
  const verified = selected || titleMatches;

  return {
    ok:verified,
    currentApp:state.currentApp,
    snapshot:observed.snapshot,
    changed:observed.changed,
    actionSeconds,
    observeSeconds:observed.seconds + (currentWindow.observeSeconds || 0),
    detail:
      `target="${target}" -> ${resolved.ref} ${resolved.role}` +
      (resolved.promoted
        ? ` (matched ${resolved.matchedRef} ${resolved.matchedRole}; promoted)`
        : "") +
      `; resolver=${resolved.method}; ` +
      `locator=${resolved.locatorDetail || "snapshot"}; ` +
      `fallback=${fallbackUsed}; selected=${selected}; ` +
      `windowObserved=${currentWindow.ok}; ` +
      `windowMethod=${currentWindow.method || "none"}; ` +
      `titleMatches=${titleMatches}; ${actionDetail}`,
    error:verified ? null : "OPEN verification failed"
  };
}

async function executeNewDocumentIntent(intent, state) {
  if (!state.currentApp) return {ok:false, error:"NEW_DOCUMENT requires an active application"};

  const action = press({
    app:state.currentApp,
    keys:"Cmd+N",
    settle:false,
  });

  if (!action.ok) {
    return {
      ok:false,
      error:`NEW_DOCUMENT Cmd+N failed: ${action.error}: ${action.detail || ""}`
    };
  }

  const changed = await waitUntilChanged(
    state.currentApp,
    state.snapshot,
    {timeoutMs:5000, pollMs:150}
  );

  if (!changed.ok) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:`NEW_DOCUMENT synchronization failed: ${changed.error}: ${changed.detail || ""}`,
    };
  }

  const stable = waitStable({
    app:state.currentApp,
    timeoutMs:5000,
    pollMs:150,
  });

  if (!stable.ok) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:`NEW_DOCUMENT stability failed: ${stable.error}: ${stable.detail || ""}`,
    };
  }

  return {
    ok:true,
    currentApp:state.currentApp,
    snapshot:stable.snapshot || changed.snapshot,
    changed:true,
    actionSeconds:action.actionSeconds,
    observeSeconds:
      (action.observeSeconds || 0) +
      (changed.observeSeconds || 0) +
      (stable.waitSeconds || 0) +
      (stable.observeSeconds || 0),
    detail:
      `computer-control.press Cmd+N; sync=changed+stable; ` +
      `changedAttempts=${changed.attempts || 0}; changed=true`
  };
}



async function executeInputIntent(intent, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"INPUT requires an active application snapshot"};
  }

  const text = intent.text == null ? "" : String(intent.text);
  const target = String(intent.target || "").trim();

  /*
   * Executor/Skill responsibility:
   * resolve WHAT semantic editable surface the intent refers to.
   *
   * Computer Control responsibility:
   * decide HOW to set and verify the text on that resolved element.
   */
  function resolveEditable(snapshot) {
    if (target) {
      const resolved = resolveSemanticTarget(snapshot, target, null, "FILL", state.currentApp);
      if (!resolved.ok) return null;

      return {
        ref:resolved.ref,
        role:resolved.role,
        name:target,
      };
    }

    return findEditableControl(snapshot);
  }

  let workingSnapshot = state.snapshot;
  let editable = resolveEditable(workingSnapshot);
  let readinessWaitSeconds = 0;
  let readinessAttempts = 0;

  if (!editable) {
    const readiness = await waitUntilSnapshotCondition(
      state.currentApp,
      snapshot => resolveEditable(snapshot),
      {timeoutMs:12000, pollMs:300}
    );

    if (!readiness.ok) {
      return {
        ok:false,
        currentApp:state.currentApp,
        snapshot:workingSnapshot,
        changed:false,
        recoveryPolicy:"NONE",
        error:
          `INPUT_PRECONDITION_NOT_READY: ${readiness.detail || readiness.error}`,
        detail:readiness.diagnostics
          ? `resource-readiness diagnostics=${JSON.stringify(readiness.diagnostics)}`
          : "no editable semantic surface observed",
      };
    }

    workingSnapshot = readiness.snapshot;
    editable = readiness.evidence || resolveEditable(workingSnapshot);
    readinessWaitSeconds = readiness.waitSeconds || 0;
    readinessAttempts = readiness.attempts || 0;
  }

  if (!editable) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:"INPUT_PRECONDITION_NOT_READY: synchronized snapshot has no editable semantic surface"
    };
  }

  const written = setText({
    app:state.currentApp,
    element:editable,
    text,
    verify:true,
  });

  return {
    ok:written.ok,
    currentApp:state.currentApp,
    snapshot:written.snapshot || workingSnapshot,
    changed:written.ok ? true : null,
    recoveryPolicy:written.ok ? undefined : "NONE",
    actionSeconds:written.actionSeconds,
    observeSeconds:(written.observeSeconds || 0) + readinessWaitSeconds,
    detail:
      `computer-control.setText; ref=${editable.ref}; role=${editable.role}; ` +
      `precondition=READY; readiness-wait=${readinessWaitSeconds.toFixed(2)}s; ` +
      `readiness-attempts=${readinessAttempts}; method=${written.method}; ` +
      `verified=${written.verified}; verification=${written.verificationMethod}; ` +
      `strategies=${JSON.stringify(written.attempts || [])}`,
    error:written.ok
      ? null
      : `${written.error || "SET_TEXT_FAILED"}: ${written.detail || "text not set"}`,
  };
}

async function executeClearIntent(intent, state) {
  if (!state.currentApp || !state.snapshot) {
    return {ok:false, error:"CLEAR requires an active application snapshot"};
  }

  const target = String(intent.target || "").trim();

  function resolveEditable(snapshot) {
    if (target) {
      const resolved = resolveSemanticTarget(snapshot, target, null, "FILL", state.currentApp);
      if (!resolved.ok) return null;

      return {
        ref:resolved.ref,
        role:resolved.role,
        name:target,
      };
    }

    return findEditableControl(snapshot);
  }

  let workingSnapshot = state.snapshot;
  let editable = resolveEditable(workingSnapshot);
  let readinessWaitSeconds = 0;
  let readinessAttempts = 0;

  if (!editable) {
    const readiness = await waitUntilSnapshotCondition(
      state.currentApp,
      snapshot => resolveEditable(snapshot),
      {timeoutMs:12000, pollMs:300}
    );

    if (!readiness.ok) {
      return {
        ok:false,
        currentApp:state.currentApp,
        snapshot:workingSnapshot,
        changed:false,
        recoveryPolicy:"NONE",
        error:
          `CLEAR_PRECONDITION_NOT_READY: ${readiness.detail || readiness.error}`,
        detail:readiness.diagnostics
          ? `resource-readiness diagnostics=${JSON.stringify(readiness.diagnostics)}`
          : "no editable semantic surface observed",
      };
    }

    workingSnapshot = readiness.snapshot;
    editable = readiness.evidence || resolveEditable(workingSnapshot);
    readinessWaitSeconds = readiness.waitSeconds || 0;
    readinessAttempts = readiness.attempts || 0;
  }

  if (!editable) {
    return {
      ok:false,
      recoveryPolicy:"NONE",
      error:"CLEAR_PRECONDITION_NOT_READY: synchronized snapshot has no editable semantic surface"
    };
  }

  const cleared = clear({
    app:state.currentApp,
    element:editable,
    verify:true,
  });

  return {
    ok:cleared.ok,
    currentApp:state.currentApp,
    snapshot:cleared.snapshot || workingSnapshot,
    changed:cleared.ok ? true : null,
    recoveryPolicy:cleared.ok ? undefined : "NONE",
    actionSeconds:cleared.actionSeconds,
    observeSeconds:(cleared.observeSeconds || 0) + readinessWaitSeconds,
    detail:
      `computer-control.clear; ref=${editable.ref}; role=${editable.role}; ` +
      `precondition=READY; readiness-wait=${readinessWaitSeconds.toFixed(2)}s; ` +
      `readiness-attempts=${readinessAttempts}; method=${cleared.method}; ` +
      `verified=${cleared.verified}; verification=${cleared.verificationMethod}; ` +
      `strategies=${JSON.stringify(cleared.attempts || [])}`,
    error:cleared.ok
      ? null
      : `${cleared.error || "CLEAR_FAILED"}: ${cleared.detail || "text not cleared"}`,
  };
}

async function executeIntent(intent, state) {
  switch (intent.intent) {
    case "ACTIVATE_APP":
      return executeActivateIntent(intent, state);
    case "SEARCH":
      return executeSearchIntent(intent, state);
    case "OPEN":
      return executeOpenIntent(intent, state);
    case "OPEN_RESULT":
      return executeOpenResultIntent(intent, state);
    case "NEW_DOCUMENT":
      return executeNewDocumentIntent(intent, state);
    case "INPUT":
      return executeInputIntent(intent, state);
    case "CLEAR":
      return executeClearIntent(intent, state);
    default:
      return {ok:false, error:`unsupported intent ${intent.intent}`};
  }
}


module.exports = {
  observeKnownApp,
  executeActivateIntent,
  executeSearchIntent,
  executeOpenResultIntent,
  executeOpenIntent,
  executeNewDocumentIntent,
  executeInputIntent,
  executeClearIntent,
  executeIntent,
};
