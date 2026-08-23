"use strict";

const {
  applicationAliasMap,
  applicationSpec,
} = require("./provider-manager");
const { normText } = require("./semantic-ui");

const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODEL = process.env.MODEL || "ministral-3:3b";
const NUM_CTX = Number(process.env.NUM_CTX || "32768");

async function warmOllama() {
  const started = performance.now();
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: "10m",
      messages: [
        {role: "user", content: "Reply with OK."}
      ],
      options: {
        temperature: 0,
        num_ctx: NUM_CTX,
        num_predict: 2
      }
    })
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Ollama warmup HTTP ${response.status}: ${body}`);
  }
  return (performance.now() - started) / 1000;
}

function nsToSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n / 1e9 : null;
}

function responseMetrics(data, wallSeconds) {
  return {
    wallSeconds,
    totalSeconds: nsToSeconds(data?.total_duration),
    loadSeconds: nsToSeconds(data?.load_duration),
    promptEvalSeconds: nsToSeconds(data?.prompt_eval_duration),
    promptEvalCount: Number.isFinite(Number(data?.prompt_eval_count)) ? Number(data.prompt_eval_count) : null,
    evalSeconds: nsToSeconds(data?.eval_duration),
    evalCount: Number.isFinite(Number(data?.eval_count)) ? Number(data.eval_count) : null,
  };
}

async function chatOllama(messages, numPredict = 160, format = "json") {
  const started = performance.now();
  const bodyData = {
    model: MODEL,
    stream: false,
    keep_alive: "10m",
    messages,
    options: {
      temperature: 0,
      num_ctx: NUM_CTX,
      num_predict: numPredict,
    },
  };
  if (format != null) bodyData.format = format;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(bodyData),
  });

  const body = await response.text();
  const wallSeconds = (performance.now() - started) / 1000;
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${body}`);

  let data;
  try { data = JSON.parse(body); }
  catch { throw new Error(`Invalid Ollama response: ${body}`); }

  return {
    content: data?.message?.content ?? "",
    seconds: wallSeconds,
    data,
    metrics: responseMetrics(data, wallSeconds),
  };
}

async function askOllama(
  prompt,
  systemMessage = "Return exactly one valid JSON object.",
  numPredict = 160
) {
  return chatOllama([
    {role: "system", content: systemMessage},
    {role: "user", content: prompt},
  ], numPredict, "json");
}

function parseModelJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch {}
  }

  throw new Error(`Model did not return a valid JSON object:\n${t}`);
}

function detectKnownAppInTask(task) {
  const text = normText(task);
  for (const [alias, spec] of Object.entries(applicationAliasMap())) {
    if (text.includes(alias)) return spec.process;
  }
  return null;
}


function explicitInputPayload(task) {
  const raw = String(task == null ? "" : task);
  const marker = /\b(?:(?:scrivi|digita|inserisci|immetti)(?:\s+(?:esattamente|letteralmente))?|(?:write|type|enter|input)(?:\s+(?:exactly|literally))?)\s*:\s*/i;
  const match = marker.exec(raw);

  if (!match) return null;

  const text = raw.slice(match.index + match[0].length);
  if (text.length === 0) return null;

  return {
    kind:"INPUT",
    source:"task-literal",
    text,
  };
}

function restoreExplicitInputPayload(steps, task) {
  const literal = explicitInputPayload(task);
  if (!literal) return {steps, literal:null, applied:false};

  const inputSteps = steps.filter(step => step.intent === "INPUT");

  // The LLM decides WHAT operation is required. The literal payload is data,
  // not semantics: only repair when there is exactly one unambiguous INPUT.
  if (inputSteps.length !== 1) {
    return {steps, literal, applied:false};
  }

  inputSteps[0].text = literal.text;
  return {steps, literal, applied:true};
}


function explicitRequestedApp(task) {
  const raw = String(task || "");

  const patterns = [
    /\b(?:apri|avvia|lancia)\s+([^,;.!?]+?)(?=\s+(?:e|poi|quindi|dopo)\b|[,;.!?]|$)/i,
    /\b(?:open|launch|start)\s+([^,;.!?]+?)(?=\s+(?:and|then|after)\b|[,;.!?]|$)/i,
  ];

  for (const rx of patterns) {
    const m = raw.match(rx);
    if (m && m[1]) return m[1].trim();
  }

  return null;
}

function normalizePlan(raw, task, mode = executionMode(task)) {
  let source = raw?.steps;
  if (!Array.isArray(source) && Array.isArray(raw?.plan)) source = raw.plan;
  if (!Array.isArray(source) && Array.isArray(raw)) source = raw;
  if (!Array.isArray(source)) source = [];

  let steps = source.map((x, i) => {
    const intent = String(x?.intent || x?.operation || x?.action || "")
      .trim()
      .toUpperCase();

    const step = {
      id: i + 1,
      intent,
      app: x?.app == null ? null : String(x.app).trim(),
      target: x?.target == null ? null : String(x.target).trim(),
      query: x?.query == null ? null : String(x.query).trim(),
      text: x?.text == null ? null : String(x.text),
      index: Number.isFinite(Number(x?.index)) ? Number(x.index) : null,
    };

    if (step.intent === "ACTIVATE_APP" && !step.app && step.target) {
      step.app = step.target;
      step.target = null;
    }
    if (step.intent === "SEARCH" && !step.query && step.target) {
      step.query = step.target;
      step.target = null;
    }
    if ((step.intent === "OPEN" || step.intent === "NAVIGATE") && !step.target && step.query) {
      step.target = step.query;
      step.query = null;
    }

    if (step.intent === "NAVIGATE") step.intent = "OPEN";
    return step;
  });

  const allowed = new Set(["ACTIVATE_APP", "SEARCH", "OPEN", "OPEN_RESULT", "NEW_DOCUMENT", "INPUT", "CLEAR"]);
  steps = steps.filter(x => allowed.has(x.intent));

  // App repair depends on execution mode.
  // GOAL may use the known platform/app registry.
  // EXACT preserves the literal application explicitly requested by the user.
  const knownApp = detectKnownAppInTask(task);
  const literalApp = explicitRequestedApp(task);
  const activationIndex = steps.findIndex(x => x.intent === "ACTIVATE_APP");

  if (mode === "EXACT" && literalApp) {
    if (activationIndex >= 0) {
      steps[activationIndex].app = literalApp;
    } else {
      steps.unshift({
        id: 0,
        intent: "ACTIVATE_APP",
        app: literalApp,
        target: null,
        query: null,
        text: null,
      });
    }
  } else if (knownApp && activationIndex < 0) {
    steps.unshift({
      id: 0,
      intent: "ACTIVATE_APP",
      app: knownApp,
      target: null,
      query: null,
      text: null,
    });
  }

  // Normalize OPEN_RESULT ordinals.
  for (const step of steps) {
    if (step.intent === "OPEN_RESULT") {
      if (!Number.isFinite(step.index) || step.index < 1) step.index = 1;
      step.target = null;
    }
  }

  // Generic repair for explicit ordinal-result requests. Small models often
  // collapse "open the first result" into OPEN(target=<query>). Preserve the
  // user's ordinal semantics instead.
  const taskText = String(task || "");
  let requestedResultIndex = null;

  const ordinalPatterns = [
    [/\b(?:first|1st)\s+result\b/i, 1],
    [/\b(?:second|2nd)\s+result\b/i, 2],
    [/\b(?:third|3rd)\s+result\b/i, 3],
    [/\bprimo\s+risultato\b/i, 1],
    [/\bsecondo\s+risultato\b/i, 2],
    [/\bterzo\s+risultato\b/i, 3],
  ];

  for (const [rx, n] of ordinalPatterns) {
    if (rx.test(taskText)) {
      requestedResultIndex = n;
      break;
    }
  }

  if (requestedResultIndex != null && steps.some(x => x.intent === "SEARCH")) {
    const already = steps.some(x => x.intent === "OPEN_RESULT");
    if (!already) {
      const searchIndex = steps.findIndex(x => x.intent === "SEARCH");
      let replaceIndex = -1;

      for (let i = searchIndex + 1; i < steps.length; i++) {
        if (steps[i].intent === "OPEN") {
          replaceIndex = i;
          break;
        }
      }

      const resultStep = {
        id: 0,
        intent: "OPEN_RESULT",
        app: null,
        target: null,
        query: null,
        text: null,
        index: requestedResultIndex,
      };

      if (replaceIndex >= 0) steps[replaceIndex] = resultStep;
      else steps.splice(searchIndex + 1, 0, resultStep);
    }
  }

  // GOAL may canonicalize known platform aliases.
  // EXACT keeps the literal requested application name.
  if (mode === "GOAL") {
    for (const step of steps) {
      if (step.intent === "ACTIVATE_APP" && step.app) {
        step.app = applicationSpec(step.app).process;
      }
    }
  }

  // Deterministic invariant 1:
  // ACTIVATE_APP already opens the application. Drop a later OPEN that merely
  // re-opens the same app, including known aliases such as
  // "System Preferences" -> "System Settings".
  let activeApp = null;
  steps = steps.filter(step => {
    if (step.intent === "ACTIVATE_APP" && step.app) {
      activeApp = applicationSpec(step.app).process;
      return true;
    }

    if (step.intent === "OPEN" && step.target && activeApp) {
      const targetAsApp = applicationSpec(step.target).process;
      if (targetAsApp === activeApp) return false;
    }

    return true;
  });

  // Deterministic invariant 2:
  // OPEN_RESULT is meaningful only for an explicitly ordinal result request.
  // If the task instead names the result (e.g. "the Bluetooth result"), and a
  // preceding SEARCH gives us that semantic name, repair OPEN_RESULT -> OPEN.
  if (requestedResultIndex == null) {
    let lastSearchQuery = null;

    for (const step of steps) {
      if (step.intent === "SEARCH" && step.query) {
        lastSearchQuery = step.query;
        continue;
      }

      if (step.intent === "OPEN_RESULT" && lastSearchQuery) {
        const q = normText(lastSearchQuery);
        const t = normText(taskText);

        const namedResult =
          t.includes(`${q} result`) ||
          t.includes(`result ${q}`) ||
          t.includes(`risultato ${q}`) ||
          t.includes(`${q} risultato`);

        if (namedResult) {
          step.intent = "OPEN";
          step.target = lastSearchQuery;
          step.query = null;
          step.index = null;
        }
      }
    }
  }

  // Literal payload boundary:
  // the planner chooses INPUT semantically, but explicitly delimited payload
  // text is restored deterministically from the original task so the LLM
  // cannot paraphrase, normalize or drop punctuation from the data.
  restoreExplicitInputPayload(steps, task);

  steps.forEach((x, i) => x.id = i + 1);
  return steps;
}


function executionMode(task) {
  const t = normText(task);

  const exactMarkers = [
    "do exactly this",
    "do exactly that",
    "follow these steps exactly",
    "follow the steps exactly",
    "exactly as i said",
    "exactly as specified",
    "use exactly",
    "fai esattamente così",
    "fai esattamente cosi",
    "fai esattamente in questo modo",
    "esegui esattamente",
    "segui esattamente",
    "rispetta esattamente",
    "usa esattamente",
  ];

  return exactMarkers.some(marker => t.includes(normText(marker)))
    ? "EXACT"
    : "GOAL";
}

async function planTask(task, contextSelection = null) {
  const mode = executionMode(task);
  const contextPrefix = contextSelection?.sessionCompiled || "(none)";

  // IMPORTANT FOR OLLAMA PREFIX CACHING:
  // Stable planner instructions + active contexts come first.
  // The volatile task is the final message, so changing tasks does not alter
  // the reusable prefix. When a new app context is activated it is appended
  // after the already-stable base context.
  const plannerSystem = `You are the semantic planner for a general computer-use agent.
Create the MINIMUM ordered plan using only these intents:
- ACTIVATE_APP(app): open/activate an application.
- SEARCH(query): execute a search.
- OPEN(target): open/select a NAMED visible destination.
- OPEN_RESULT(index): open a result requested by EXPLICIT ORDINAL position.
- NEW_DOCUMENT: create a new document in the selected editor.
- INPUT(target,text): enter non-search text.
- CLEAR(target): erase all text from an editable surface.

GENERAL INVARIANTS:
1. ACTIVATE_APP already opens/activates the application. Never add OPEN for the same application.
2. OPEN_RESULT is ONLY for explicit ordinal language: first, second, third, 1st, 2nd, etc.
3. A named destination/result is OPEN(target=<name>), unless active context gives a more specific rule.
4. GOAL mode optimizes for the requested outcome and may omit redundant steps or use an equivalent shorter path.
5. EXACT mode preserves every explicitly requested operation and its order unless execution is impossible.
6. Active operational context is the most specific domain knowledge and has priority over general heuristics.
7. If CAPABILITY / PROVIDER SELECTION names a selected application provider, use that app. Competence is derived from validated Skills; do not invent missing Skill knowledge.

CAPABILITY / PROVIDER SELECTION:
${contextSelection?.capability?.required?.length
  ? (() => {
      const selected = contextSelection.capability.selectedProvider;
      const comp = selected?.competence;
      return [
        `required=${contextSelection.capability.required.join(", ")}`,
        `selected-provider=${selected?.name || "none"}`,
        `selected-app=${contextSelection.capability.selectedApp || "none"}`,
        `competence=${comp?.status || "UNKNOWN"}`,
        `skill-coverage=${comp?.coverage || "0/0"}`,
        `failed-skills=${comp?.failed?.join(",") || "none"}`,
        `unknown-skills=${comp?.unknown?.join(",") || "none"}`,
        `reason=${contextSelection.capability.reason || ""}`,
      ].join("; ");
    })()
  : "(none)"}

ACTIVE OPERATIONAL CONTEXT:
${contextPrefix}`;

  const taskMessage = `TASK:\n${task}\n\nEXECUTION MODE: ${mode}\n\nReturn JSON only:\n{"steps":[{"intent":"ACTIVATE_APP|SEARCH|OPEN|OPEN_RESULT|NEW_DOCUMENT|INPUT|CLEAR","app":null,"target":null,"query":null,"text":null,"index":null}]}`;

  const r = await chatOllama([
    {role: "system", content: plannerSystem},
    {role: "user", content: taskMessage},
  ], 220, "json");

  const raw = parseModelJson(r.content);
  let steps = normalizePlan(raw, task, mode);

  const selectedApp = contextSelection?.capability?.selectedApp || null;
  if (mode === "GOAL" && selectedApp) {
    const activationIndex = steps.findIndex(x => x.intent === "ACTIVATE_APP");
    if (activationIndex >= 0) {
      steps[activationIndex].app = selectedApp;
    } else {
      steps.unshift({
        id:0, intent:"ACTIVATE_APP", app:selectedApp,
        target:null, query:null, text:null, index:null
      });
    }
    steps.forEach((x,i) => x.id = i + 1);
  }

  if (!steps.length) throw new Error(`Planner returned no executable intents: ${r.content}`);

  const literalPayload = explicitInputPayload(task);
  const literalInputCount = steps.filter(step => step.intent === "INPUT").length;

  return {
    steps,
    seconds: r.seconds,
    raw,
    mode,
    metrics: r.metrics,
    prefixChars: plannerSystem.length,
    taskChars: taskMessage.length,
    literalPayload:literalPayload
      ? {
          kind:literalPayload.kind,
          source:literalPayload.source,
          chars:literalPayload.text.length,
          applied:literalInputCount === 1,
        }
      : null,
  };
}

module.exports = {
  OLLAMA_URL,
  MODEL,
  NUM_CTX,
  warmOllama,
  chatOllama,
  responseMetrics,
  askOllama,
  parseModelJson,
  detectKnownAppInTask,
  explicitInputPayload,
  restoreExplicitInputPayload,
  explicitRequestedApp,
  normalizePlan,
  executionMode,
  planTask,
};
