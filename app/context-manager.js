"use strict";

/**
 * RumiAI Computer Use - Context Manager micro-PoC
 *
 * Two distinct concepts:
 *   - context selection for the current plan;
 *   - session-active application context, retained across user tasks.
 *
 * Base contexts (e.g. generic-gui plus the current OS context) are always active.
 * Application contexts become session-active after the runtime actually observes that app.
 * A task may preview a relevant app context before activation so the planner
 * can use its competence to create the plan that opens the app.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTEXT_DIR = process.env.RUMIAI_CONTEXT_DIR || path.join(ROOT, "contexts");

function norm(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function readContextFile(file) {
  const full = path.join(CONTEXT_DIR, file);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  if (!data.id || !data.name) {
    throw new Error(`Invalid context file ${file}: id and name are required`);
  }
  return data;
}

function loadContexts() {
  if (!fs.existsSync(CONTEXT_DIR)) return [];
  return fs.readdirSync(CONTEXT_DIR)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(readContextFile);
}

function platformTriggerMatches(context) {
  const trigger = context.trigger || {};
  const platforms = Array.isArray(trigger.platforms)
    ? trigger.platforms.map(norm).filter(Boolean)
    : [];
  if (platforms.length === 0) return true;
  return platforms.includes(norm(process.platform));
}

function taskTriggerMatches(context, task) {
  const trigger = context.trigger || {};
  if (trigger.always === true) return true;

  const text = norm(task);
  const any = Array.isArray(trigger.task_contains_any)
    ? trigger.task_contains_any.map(norm).filter(Boolean)
    : [];

  return any.length > 0 && any.some(term => text.includes(term));
}

function appTriggerMatches(context, app) {
  if (!app) return false;
  const trigger = context.trigger || {};
  const names = Array.isArray(trigger.app_names)
    ? trigger.app_names.map(norm).filter(Boolean)
    : [];
  const current = norm(app);
  return names.some(name => current === name || current.includes(name) || name.includes(current));
}

function uniqueSorted(contexts) {
  const byId = new Map();
  for (const c of contexts) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
}

function expandDependencies(contexts, all) {
  const byId = new Map(all.map(c => [c.id, c]));
  const out = new Map();

  function add(c) {
    if (!c || out.has(c.id)) return;
    for (const id of (Array.isArray(c.requires) ? c.requires : [])) add(byId.get(id));
    out.set(c.id, c);
  }

  for (const c of contexts) add(c);
  return uniqueSorted([...out.values()]);
}

function contextLines(context) {
  // A session context may be richer than the old compressed planner_delta:
  // prefix caching is what we are testing. Keep the representation stable.
  const lines = [];
  if (context.scope) lines.push(`scope: ${String(context.scope).trim()}`);

  const knowledge = Array.isArray(context.knowledge) ? context.knowledge : [];
  for (const x of knowledge) lines.push(`knowledge: ${String(x).trim()}`);

  const rules = Array.isArray(context.planning_rules) ? context.planning_rules : [];
  for (const x of rules) lines.push(`rule: ${String(x).trim()}`);

  const delta = Array.isArray(context.planner_delta) ? context.planner_delta : [];
  for (const x of delta) lines.push(`priority-rule: ${String(x).trim()}`);

  return lines.filter(Boolean);
}

function compileSessionContexts(contexts) {
  const blocks = [];
  for (const context of contexts) {
    const lines = contextLines(context);
    if (!lines.length) continue;
    blocks.push(`[context:${context.id}]\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n") || "(none)";
}

// Retained for compatibility with existing files/tests.
function compileContexts(contexts) {
  const blocks = [];
  for (const context of contexts) {
    const delta = Array.isArray(context.planner_delta)
      ? context.planner_delta.map(String).map(x => x.trim()).filter(Boolean)
      : [];
    if (!delta.length) continue;
    blocks.push(`[${context.id}] ${delta.join(" ")}`);
  }
  return blocks.join("\n") || "(none)";
}

function contextSummary(selectionOrContexts) {
  const contexts = Array.isArray(selectionOrContexts)
    ? selectionOrContexts
    : (selectionOrContexts?.selected || []);
  return contexts.map(c => c.id).join(" -> ") || "none";
}

function createContextSession() {
  const all = loadContexts();
  const available = all.filter(platformTriggerMatches);
  const base = uniqueSorted(available.filter(c => c.trigger?.always === true));
  let currentApp = null;
  let appActive = [];

  function activeContexts() {
    return uniqueSorted([...base, ...appActive]);
  }

  function select(task, extraContextIds = []) {
    const taskSelected = available.filter(c => taskTriggerMatches(c, task));
    const extraSelected = available.filter(c => extraContextIds.includes(c.id));
    const selected = expandDependencies([...base, ...appActive, ...taskSelected, ...extraSelected], available);
    const persistedIds = new Set(activeContexts().map(c => c.id));
    return {
      task,
      currentApp,
      base,
      persisted: activeContexts(),
      preview: selected.filter(c => !persistedIds.has(c.id)),
      selected,
      compiled: compileContexts(selected),
      sessionCompiled: compileSessionContexts(selected),
    };
  }

  function observeApp(app) {
    currentApp = app || null;
    appActive = currentApp
      ? expandDependencies(available.filter(c => appTriggerMatches(c, currentApp)), available)
          .filter(c => !base.some(b => b.id === c.id))
      : [];
    return activeContexts();
  }

  function snapshot() {
    return {
      currentApp,
      active: activeContexts(),
      compiled: compileSessionContexts(activeContexts()),
    };
  }

  return { select, observeApp, snapshot };
}

// Stateless compatibility helper.
function selectContexts(task) {
  return createContextSession().select(task);
}

module.exports = {
  CONTEXT_DIR,
  loadContexts,
  selectContexts,
  createContextSession,
  compileContexts,
  compileSessionContexts,
  expandDependencies,
  contextSummary,
};
