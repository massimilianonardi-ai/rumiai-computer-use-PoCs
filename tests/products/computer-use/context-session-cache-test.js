#!/usr/bin/env node
"use strict";

const path = require("node:path");
const portableRoot = path.resolve(__dirname, "../../../../..");
const appRoot = path.join(
  process.env.RUMIAI_COMPUTER_USE_ROOT || path.join(portableRoot, "app", "computer-use"),
  "app"
);
const { warmOllama, planTask, MODEL, OLLAMA_URL } = require(path.join(appRoot, "llm"));
const { createContextSession, contextSummary } = require(path.join(appRoot, "context-manager"));

function fmt(label, r, selection) {
  const m = r.metrics || {};
  console.log(`\n${label}`);
  console.log(`  contexts:     ${contextSummary(selection)}`);
  console.log(`  prefix chars: ${r.prefixChars}`);
  console.log(`  wall:         ${r.seconds.toFixed(3)}s`);
  if (m.promptEvalSeconds != null) console.log(`  prompt eval:  ${m.promptEvalSeconds.toFixed(3)}s (${m.promptEvalCount ?? "?"} tokens)`);
  if (m.evalSeconds != null) console.log(`  decode:       ${m.evalSeconds.toFixed(3)}s (${m.evalCount ?? "?"} tokens)`);
  console.log(`  plan:         ${JSON.stringify(r.steps)}`);
}

async function one(session, label, task) {
  const selection = session.select(task);
  const r = await planTask(task, selection);
  fmt(label, r, selection);
  return r;
}

async function main() {
  console.log(`RumiAI Context Session / Ollama prefix-cache test`);
  console.log(`model: ${MODEL}`);
  try {
    const vr = await fetch(`${OLLAMA_URL}/api/version`);
    if (vr.ok) {
      const v = await vr.json();
      console.log(`Ollama version: ${v.version || "unknown"}`);
    }
  } catch {}
  const warm = await warmOllama();
  console.log(`warmup: ${warm.toFixed(3)}s`);

  const session = createContextSession();
  console.log(`base session: ${contextSummary(session.snapshot().active)}`);

  // Same BASE prefix, different volatile task.
  await one(session, "A1 BASE first branch", "Open Finder.");
  await one(session, "A2 BASE same-prefix branch", "Open Safari.");

  // Add System Settings as a task-preview context. Base prefix remains the same;
  // system-settings is appended after it.
  await one(session, "B1 BASE + System Settings first branch", "Open System Settings and open Bluetooth.");

  // Persist the app context as if the runtime had successfully activated it.
  session.observeApp("System Settings");
  await one(session, "B2 BASE + System Settings same-prefix branch", "Open Wi-Fi.");

  console.log("\nInterpretation:");
  console.log("- Compare A1 vs A2 prompt-eval time: same base prefix, new task.");
  console.log("- Compare B1 vs B2 prompt-eval time: same extended prefix, new task.");
  console.log("- Decode time is output generation and is not removed by prefix caching.");
  console.log("- /api/chat still serializes the messages; this test measures compute reuse, not network omission.");
}

main().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
