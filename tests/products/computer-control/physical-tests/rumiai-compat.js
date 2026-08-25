#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const control = require(path.join(productRoot, "adapters/rumiai/compat"));

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-compat-"));
  const fixture = path.join(directory, "rumiai-external-computer-control.txt");
  const requested = "RumiAI external Computer Control PASS";
  fs.writeFileSync(fixture, "compat fixture", "utf8");
  let failed = false;
  try {
    const runtime = control.ensureRuntime();
    if (!runtime.ok) throw new Error(runtime.detail || "runtime unavailable");
    if (spawnSync("/usr/bin/open", ["-a", "TextEdit", fixture]).status !== 0) throw new Error("fixture open failed");
    const ready = await control.ensureReady("TextEdit");
    if (!ready.ok) throw new Error(ready.detail || "TextEdit not ready");
    const snapshot = control.snapshot({app:"TextEdit", settle:true, compact:true});
    const found = control.find({app:"TextEdit", role:"text-field", snapshot:snapshot.snapshot});
    if (!found.ok) throw new Error(found.detail || "editable target not found");
    const written = control.setText({app:"TextEdit", element:{ref:found.ref, role:"text-field"}, text:requested, verify:true});
    const observed = control.get({app:"TextEdit", element:{ref:found.ref}, property:"text"});
    const checks = {
      "compat-runtime":runtime.ok,
      "compat-application-ready":ready.ok,
      "compat-snapshot":snapshot.ok,
      "compat-find":found.ok && /^@e\d+$/.test(found.ref),
      "compat-set-text":written.ok && written.verified === true,
      "compat-get-exact":observed.ok && observed.value === requested,
    };
    for (const [name, pass] of Object.entries(checks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
    failed = Object.values(checks).some(pass => !pass);
    console.log(`physical-rumiai-external-adapter=${failed ? "FAIL" : "PASS"}`);
  } finally {
    try { control.press({app:"TextEdit", keys:"Cmd+S", settle:true}); } catch (_) {}
    try { control.press({app:"TextEdit", keys:"Cmd+W", settle:false}); } catch (_) {}
    control.shutdownRuntime();
    if (fs.existsSync(fixture)) fs.unlinkSync(fixture);
    if (fs.existsSync(directory)) fs.rmdirSync(directory);
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => {
  console.error("physical-rumiai-external-adapter=BLOCKED");
  console.error(error.message);
  try { control.shutdownRuntime(); } catch (_) {}
  process.exit(1);
});
