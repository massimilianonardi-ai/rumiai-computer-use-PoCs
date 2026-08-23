#!/usr/bin/env node
"use strict";

/**
 * RumiAI Computer Use PoC13
 *
 * Thin orchestration layer:
 *   task -> semantic plan -> intent executors -> verification/recovery
 *
 * Implementation details live in:
 *   llm.js, semantic-ui.js, computer-control/, executors.js, recovery.js
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const {
  applicationSpec,
  sameApplication,
} = require("./provider-manager");
const {
  runtimeInfo,
  ensureRuntime,
  shutdownRuntime,
  getForeground,
} = require("./computer-control");
const { OLLAMA_URL, MODEL, warmOllama, planTask, executionMode } = require("./llm");
const { createContextSession, contextSummary } = require("./context-manager");
const { selectCapabilityTool } = require("./capability-manager");
const { executeIntent, executeActivateIntent } = require("./executors");
const {
  strongBlockerEvidence,
  locateOrdinalResult,
  decideRecovery,
  executeRecoveryAction,
} = require("./recovery");

const ROOT = path.resolve(__dirname, "..");
const WORKSPACE = path.join(ROOT, "workspace");
const MAX_RECOVERY_PER_INTENT = Number(process.env.MAX_RECOVERY_PER_INTENT || "3");
const contextSession = createContextSession();
let computerSessionState = {
  currentApp: null,
  snapshot: "",
  changed: null,
};

let computerControlCleanupDone = false;

fs.mkdirSync(WORKSPACE, { recursive: true });

async function runTask(task) {
  console.log("");
  console.log(`TASK: ${task}`);
  console.log(`MODEL: ${MODEL}`);
  console.log(`MODE: context-select -> semantic-plan -> deterministic executors -> classified recovery/locator`);
  const mode = executionMode(task);
  console.log(`[execution-mode] ${mode}`);
  console.log("");

  const runtime = ensureRuntime();
  if (!runtime.ok) {
    throw new Error(
      `${runtime.error}: ${runtime.detail || "Computer Control backend unavailable"}`
    );
  }

  // Two different notions of "where we are":
  // - working app: persistent cognitive/work context from prior CU actions.
  // - foreground app: actual macOS app receiving input right now.
  let state = { ...computerSessionState };
  if (state.currentApp) {
    console.log(`[computer-session] working-app: ${state.currentApp}`);
  } else {
    console.log(`[computer-session] working-app: (none)`);
  }

  const foregroundAtTaskStart = getForeground();
  if (foregroundAtTaskStart.ok) {
    console.log(
      `[computer-state] foreground-app: ${foregroundAtTaskStart.name}` +
      `${foregroundAtTaskStart.bundle ? ` (${foregroundAtTaskStart.bundle})` : ""}` +
      ` | source=computer-control | method=${foregroundAtTaskStart.method}`
    );
  } else {
    console.log(`[computer-state] foreground-app: unknown | ${foregroundAtTaskStart.error}`);
  }
  console.log("");

  let capabilitySelection;
  try {
    capabilitySelection = selectCapabilityTool(task, mode);
  } catch (e) {
    console.log(`[capability] ERROR: ${e.message}`);
    return;
  }

  if (capabilitySelection.required.length) {
    console.log(`[capability] required: ${capabilitySelection.required.join(", ")}`);

    for (const c of capabilitySelection.candidates) {
      const comp = c.competence;
      console.log(
        `[provider] candidate: ${c.name}` +
        ` | available=${c.available}` +
        ` | competence=${comp.status}` +
        ` | skill-coverage=${comp.coverage}`
      );

      for (const skill of comp.required) {
        const status =
          comp.validated.includes(skill) ? "VALIDATED" :
          comp.failed.includes(skill) ? "FAILED" :
          "UNKNOWN";

        console.log(`[skill] ${c.name}/${skill}: ${status}`);
      }
    }

    const selected = capabilitySelection.selectedProvider;
    console.log(
      `[provider] selected: ${selected?.name || "(none)"}` +
      `${selected ? ` | competence=${selected.competence.status}` : ""}` +
      ` | reason=${capabilitySelection.reason}`
    );
  }

  let contextSelection;
  try {
    contextSelection = contextSession.select(task, capabilitySelection.contextIds);
    contextSelection.capability = capabilitySelection;
  } catch (e) {
    console.log(`[context] ERROR: ${e.message}`);
    return;
  }

  console.log(`[context] planner: ${contextSummary(contextSelection)}`);
  if (contextSelection.preview?.length) {
    console.log(`[context] preview-add: ${contextSummary(contextSelection.preview)}`);
  }

  fs.writeFileSync(
    path.join(WORKSPACE, "last-context.json"),
    JSON.stringify({
      task,
      selected: contextSelection.selected,
      compiled: contextSelection.compiled,
      capability: capabilitySelection,
    }, null, 2)
  );

  let planned;
  try {
    planned = await planTask(task, contextSelection);
  } catch (e) {
    console.log(`[plan] ERROR: ${e.message}`);
    return;
  }

  let plan = planned.steps;

  // In GOAL mode, ACTIVATE_APP is needed only when the requested app is not
  // already foreground. This uses the actual macOS foreground state, not the
  // persistent working-app context.
  if (mode === "GOAL" && foregroundAtTaskStart.ok) {
    let simulatedForeground = foregroundAtTaskStart;
    const optimized = [];

    for (const step of plan) {
      if (step.intent === "ACTIVATE_APP" && step.app) {
        if (sameApplication(step.app, simulatedForeground)) {
          console.log(
            `[plan-normalize] drop ACTIVATE_APP "${step.app}": already foreground`
          );
          simulatedForeground = {
            ok:true,
            name:step.app,
            bundle:null,
          };
          continue;
        }

        optimized.push(step);
        const desiredSpec = applicationSpec(step.app);
        simulatedForeground = {
          ok:true,
          name:desiredSpec.process,
          bundle:desiredSpec.bundle,
        };
        continue;
      }

      optimized.push(step);
    }

    plan = optimized.map((step, i) => ({ ...step, id:i + 1 }));
  }

  console.log(`[plan] inference: ${planned.seconds.toFixed(2)}s`);
  if (planned.metrics) {
    const m = planned.metrics;
    console.log(
      `[planner-prefix] chars=${planned.prefixChars} | task-chars=${planned.taskChars}` +
      `${m.promptEvalCount != null ? ` | prompt-tokens=${m.promptEvalCount}` : ""}`
    );
    console.log(
      `[ollama-metrics]` +
      `${m.promptEvalSeconds != null ? ` prompt-eval=${m.promptEvalSeconds.toFixed(3)}s` : ""}` +
      `${m.evalSeconds != null ? ` | decode=${m.evalSeconds.toFixed(3)}s` : ""}` +
      `${m.evalCount != null ? ` | output-tokens=${m.evalCount}` : ""}` +
      `${m.loadSeconds != null ? ` | load=${m.loadSeconds.toFixed(3)}s` : ""}`
    );
  }
  if (planned.literalPayload) {
    console.log(
      `[payload] kind=${planned.literalPayload.kind}` +
      ` | source=${planned.literalPayload.source}` +
      ` | chars=${planned.literalPayload.chars}` +
      ` | applied=${planned.literalPayload.applied}`
    );
  }
  console.log(`[plan] ${JSON.stringify(plan)}`);

  fs.writeFileSync(
    path.join(WORKSPACE, "last-plan.json"),
    JSON.stringify({task, plan}, null, 2)
  );

  let recoveryInferenceTotal = 0;
  let locatorInferenceTotal = 0;
  const startTask = performance.now();

  for (let i = 0; i < plan.length; i++) {
    const intent = plan[i];
    const recoveryHistory = [];

    console.log("");
    console.log(`[intent ${i + 1}/${plan.length}] ${JSON.stringify(intent)}`);

    fs.writeFileSync(
      path.join(WORKSPACE, `intent-${i + 1}-before.txt`),
      state.snapshot || "(no application snapshot yet)\n"
    );

    let passed = false;
    let lastFailure = null;

    // Application readiness is an execution precondition, not a semantic user
    // intent. EXACT preserves the requested operation order while the executor
    // guarantees that the selected provider is actually foreground and has a
    // current observable snapshot before application-dependent operations run.
    if (intent.intent !== "ACTIVATE_APP" && intent.app) {
      const foreground = getForeground();
      const workingMatches = Boolean(
        state.currentApp &&
        sameApplication(intent.app, {name:state.currentApp, bundle:null})
      );
      const foregroundMatches = Boolean(
        foreground.ok && sameApplication(intent.app, foreground)
      );
      const applicationReady = workingMatches && foregroundMatches && Boolean(state.snapshot);

      if (!applicationReady) {
        let readiness;
        try {
          readiness = await executeActivateIntent(
            {intent:"ACTIVATE_APP", app:intent.app},
            state
          );
        } catch (e) {
          readiness = {
            ok:false,
            recoveryPolicy:"NONE",
            error:`application readiness exception: ${e.message}`,
          };
        }

        if (!readiness.ok) {
          console.log(
            `[intent ${i + 1}] precondition FAIL: application-ready ${intent.app}: ` +
            `${readiness.error || "provider did not become ready"}`
          );
          if (readiness.detail) {
            console.log(`[intent ${i + 1}] precondition detail: ${readiness.detail}`);
          }
          console.log(`[intent ${i + 1}] FAIL: application readiness precondition not satisfied`);
          return;
        }

        state = {
          currentApp: readiness.currentApp ?? state.currentApp,
          snapshot: readiness.snapshot ?? state.snapshot,
          changed: readiness.changed ?? null,
        };
        computerSessionState = { ...state };

        if (state.currentApp) {
          const active = contextSession.observeApp(state.currentApp);
          console.log(`[context-session] active: ${contextSummary(active)}`);
        }

        console.log(
          `[intent ${i + 1}] precondition PASS | application-ready=${state.currentApp}` +
          ` | source=executor` +
          `${readiness.detail ? ` | ${readiness.detail}` : ""}`
        );
      }
    }

    for (let attempt = 0; attempt <= MAX_RECOVERY_PER_INTENT; attempt++) {
      let result;

      try {
        result = await executeIntent(intent, state);
      } catch (e) {
        result = {
          ok:false,
          recoveryPolicy:"NONE",
          error:`executor exception: ${e.message}`,
          detail:"internal executor error; GUI recovery is unsafe and suppressed"
        };
      }

      if (result.ok) {
        state = {
          currentApp: result.currentApp ?? state.currentApp,
          snapshot: result.snapshot ?? state.snapshot,
          changed: result.changed ?? null,
        };

        computerSessionState = { ...state };
        if (state.currentApp) {
          const active = contextSession.observeApp(state.currentApp);
          console.log(`[context-session] active: ${contextSummary(active)}`);
        }

        fs.writeFileSync(
          path.join(WORKSPACE, `intent-${i + 1}-after.txt`),
          state.snapshot || "(no application snapshot)\n"
        );

        console.log(
          `[intent ${i + 1}] PASS` +
          `${attempt > 0 ? ` after ${attempt} corrective action(s)` : ""}` +
          `${Number.isFinite(result.actionSeconds) ? ` | action=${result.actionSeconds.toFixed(2)}s` : ""}` +
          `${Number.isFinite(result.observeSeconds) ? ` | observe=${result.observeSeconds.toFixed(2)}s` : ""}`
        );
        if (result.detail) console.log(`[intent ${i + 1}] ${result.detail}`);

        passed = true;
        break;
      }

      lastFailure = result;

      console.log(`[intent ${i + 1}] attempt ${attempt + 1} failed: ${result.error || "verification failed"}`);
      if (result.detail) console.log(`[intent ${i + 1}] detail: ${result.detail}`);

      fs.writeFileSync(
        path.join(WORKSPACE, `intent-${i + 1}-failure-${attempt + 1}.txt`),
        state.snapshot || "(no application snapshot)\n"
      );

      // EXACT makes an explicitly requested application part of the method.
      // If that application cannot be activated, do not silently recover by
      // substituting another application.
      if (mode === "EXACT" && intent.intent === "ACTIVATE_APP") {
        console.log(`[intent ${i + 1}] EXACT method constraint: application substitution is disabled.`);
        break;
      }

      // Deterministic precondition/readiness failures are not evidence of a
      // UI blocker. Never ask the LLM to invent a corrective action.
      if (result.recoveryPolicy === "NONE") {
        console.log(
          `[intent ${i + 1}] recovery suppressed: deterministic operation/precondition failure.`
        );
        break;
      }

      if (attempt >= MAX_RECOVERY_PER_INTENT) break;

      // OPEN_RESULT needs state classification. "No result candidate" does not
      // automatically mean "there is a blocker".
      if (intent.intent === "OPEN_RESULT") {
        const blocker = strongBlockerEvidence(state.snapshot);

        console.log(`[intent ${i + 1}] state classification: ${blocker.blocked ? "BLOCKER" : "RESULT-LOCATOR"} | ${blocker.reason}`);

        if (!blocker.blocked) {
          let located;
          try {
            located = await locateOrdinalResult(intent, state);
          } catch (e) {
            located = {ok:false, error:`result locator exception: ${e.message}`};
          }

          locatorInferenceTotal += located.inferenceSeconds || 0;

          if (Number.isFinite(located.inferenceSeconds)) {
            console.log(`[intent ${i + 1}] locator inference: ${located.inferenceSeconds.toFixed(2)}s`);
          }

          if (located.ok) {
            state = {
              currentApp: located.currentApp ?? state.currentApp,
              snapshot: located.snapshot ?? state.snapshot,
              changed: located.changed ?? null,
            };
            computerSessionState = { ...state };
            if (state.currentApp) contextSession.observeApp(state.currentApp);

            console.log(
              `[intent ${i + 1}] PASS via result locator` +
              `${Number.isFinite(located.actionSeconds) ? ` | action=${located.actionSeconds.toFixed(2)}s` : ""}` +
              `${Number.isFinite(located.observeSeconds) ? ` | observe=${located.observeSeconds.toFixed(2)}s` : ""}`
            );
            if (located.detail) {
              console.log(`[intent ${i + 1}] locator detail: ${located.detail}`);
            }

            fs.writeFileSync(
              path.join(WORKSPACE, `intent-${i + 1}-after.txt`),
              state.snapshot || "(no application snapshot)\n"
            );

            passed = true;
            break;
          }

          console.log(`[intent ${i + 1}] locator FAIL: ${located.error}`);
          if (located.detail) console.log(`[intent ${i + 1}] locator detail: ${located.detail}`);

          if (located.code === "SURFACE_NOT_OBSERVABLE") {
            console.log(
              `[intent ${i + 1}] surface capability: NOT_OBSERVABLE ` +
              `| capability=result-content.observe | backend=agent-ctrl`
            );
          }

          // If there is no blocker and the locator cannot identify a result,
          // do not let generic recovery click arbitrary account/settings UI.
          console.log(`[intent ${i + 1}] stopped: no blocker and no identifiable result.`);
          break;
        }
      }

      // Only genuine blocker states arrive here.
      let recovery;
      try {
        recovery = await decideRecovery(intent, result, state, recoveryHistory);
      } catch (e) {
        console.log(`[intent ${i + 1}] recovery inference ERROR: ${e.message}`);
        break;
      }

      recoveryInferenceTotal += recovery.seconds || 0;

      const recoveryKey = JSON.stringify({
        action:recovery.action,
        target:recovery.target,
        role:recovery.role,
        text:recovery.text,
        keys:recovery.keys
      });

      if (recoveryHistory.includes(recoveryKey)) {
        console.log(`[intent ${i + 1}] recovery stopped: repeated corrective action rejected.`);
        break;
      }

      console.log(
        `[intent ${i + 1}] recovery ${recovery.deterministic ? "deterministic" : `inference: ${recovery.seconds.toFixed(2)}s`}`
      );
      console.log(
        `[intent ${i + 1}] recovery decision: ${JSON.stringify({
          action:recovery.action,
          target:recovery.target,
          role:recovery.role,
          text:recovery.text,
          keys:recovery.keys,
          reason:recovery.reason
        })}`
      );

      if (recovery.action === "NO_RECOVERY") {
        console.log(`[intent ${i + 1}] recovery stopped: no safe corrective action.`);
        break;
      }

      let recovered;
      try {
        recovered = await executeRecoveryAction(recovery, state);
      } catch (e) {
        console.log(`[intent ${i + 1}] recovery executor ERROR: ${e.message}`);
        break;
      }

      recoveryHistory.push(recoveryKey);

      if (!recovered.ok) {
        console.log(`[intent ${i + 1}] recovery FAIL: ${recovered.error}`);
        if (recovered.detail) {
          console.log(`[intent ${i + 1}] recovery detail: ${recovered.detail}`);
        }
        break;
      }

      state = {
        currentApp: recovered.currentApp ?? state.currentApp,
        snapshot: recovered.snapshot ?? state.snapshot,
        changed: recovered.changed ?? null,
      };
      computerSessionState = { ...state };
      if (state.currentApp) contextSession.observeApp(state.currentApp);

      console.log(
        `[intent ${i + 1}] recovery PASS` +
        `${Number.isFinite(recovered.actionSeconds) ? ` | action=${recovered.actionSeconds.toFixed(2)}s` : ""}` +
        `${Number.isFinite(recovered.observeSeconds) ? ` | observe=${recovered.observeSeconds.toFixed(2)}s` : ""}`
      );
      if (recovered.detail) {
        console.log(`[intent ${i + 1}] recovery detail: ${recovered.detail}`);
      }

      fs.writeFileSync(
        path.join(WORKSPACE, `intent-${i + 1}-recovery-${attempt + 1}.txt`),
        state.snapshot || "(no application snapshot)\n"
      );

      console.log(`[intent ${i + 1}] retrying original intent...`);
    }

    if (!passed) {
      console.log(
        `[intent ${i + 1}] FAIL: ${lastFailure?.error || "intent could not be completed"}`
      );
      return;
    }
  }

  const executionTotal = (performance.now() - startTask) / 1000;

  console.log("");
  console.log(`TASK COMPLETE: all ${plan.length} intents verified.`);
  console.log(
    `Execution loop: ${executionTotal.toFixed(2)}s ` +
    `(planner inference excluded; corrective inference included in wall time).`
  );
  console.log(`Planner inference: ${planned.seconds.toFixed(2)}s.`);
  console.log(`Recovery inference: ${recoveryInferenceTotal.toFixed(2)}s.`);
  console.log(`Locator inference: ${locatorInferenceTotal.toFixed(2)}s.`);
  console.log(
    `Total incl. planner: ${(executionTotal + planned.seconds).toFixed(2)}s.`
  );
}

let agentCtrlCleanupDone = false;

function cleanupComputerControl() {
  if (computerControlCleanupDone) return;
  computerControlCleanupDone = true;

  try {
    const r = shutdownRuntime();

    if (r.ok) {
      console.log(
        `[computer-control] backend=${r.backend?.id || "unknown"} runtime closed.`
      );
    } else {
      console.log(
        `[computer-control] runtime close warning: ` +
        `${r.detail || r.error || "unknown close failure"}`
      );
    }
  } catch (e) {
    console.log(`[computer-control] runtime close warning: ${e.message}`);
  }
}

async function main() {
  // The test harness owns the default agent-ctrl daemon lifecycle.
  // `exit`, EOF and process.exit()/SIGINT all converge on this synchronous
  // cleanup handler so a runaway daemon cannot remain consuming CPU.
  process.once("exit", cleanupComputerControl);

  const backend = runtimeInfo();
  if (!backend.available) {
    console.error(
      `ERROR: Computer Control backend unavailable: ` +
      `${backend.id} | ${backend.path}`
    );
    process.exit(1);
  }

  // Quick Ollama reachability check.
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`ERROR: Ollama not reachable at ${OLLAMA_URL}: ${e.message}`);
    process.exit(1);
  }

  try {
    const warmSeconds = await warmOllama();
    console.log(`\n---> model warmup: ${warmSeconds.toFixed(2)}s`);
  } catch (e) {
    console.error(`ERROR warming model: ${e.message}`);
    process.exit(1);
  }

  console.log("");
  console.log("RumiAI local Computer Control PoC v13 + Application Readiness Invariant micro-PoC v48");
  console.log(
    `computer-control backend: ${backend.id}` +
    `${backend.path ? ` | ${backend.path}` : ""}`
  );
  console.log(`Ollama:     ${OLLAMA_URL}`);
  console.log(`model:      ${MODEL}`);
  console.log("vision:     off");
  console.log("shell:      unavailable");
  console.log("LLM planner uses a stable context prefix for Ollama cache/snapshot reuse");
  console.log(`[context-session] boot: ${contextSummary(contextSession.snapshot().active)}`);
  console.log("");
  console.log("Type 'exit' to quit.");
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = () => {
    rl.question("Agent task> ", async answer => {
      // Preserve the raw task string for literal payload fidelity. Semantic
      // checks may trim their own views, but payload data must not be globally
      // normalized before the planner boundary.
      const task = String(answer);
      const command = task.trim();
      if (!command) return ask();
      if (["exit", "quit"].includes(command.toLowerCase())) {
        rl.close();
        return;
      }
      try {
        await runTask(task);
      } catch (e) {
        console.log(`ERROR: ${e.stack || e.message}`);
      }
      console.log("");
      ask();
    });
  };

  rl.on("close", () => {
    cleanupComputerControl();
  });

  rl.on("SIGINT", () => {
    console.log("\nCancelled.");
    rl.close();
    process.exit(130);
  });

  ask();
}

main().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
