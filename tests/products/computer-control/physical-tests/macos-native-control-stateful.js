#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const ROOT = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const NODE = process.env.RUMIAI_CC_NODE || process.execPath;
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-stateful-physical.sock";
const {ComputerControlClient} = require(path.join(ROOT, "sdk/typescript/src"));

function check(label, condition) {
  console.log(`${label}=${condition ? "PASS" : "FAIL"}`);
  if (!condition) throw new Error(label);
}

function waitForRuntime(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    let errors = "";
    const timer = setTimeout(() => reject(new Error(`runtime startup timeout: ${errors}`)), 10000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.includes('"event":"runtime.ready"')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", chunk => { errors += chunk; });
    child.once("exit", code => {
      clearTimeout(timer);
      reject(new Error(`runtime exited before ready: ${code}; ${errors}`));
    });
  });
}

async function main() {
  if (process.platform !== "darwin") throw new Error("macOS physical test required");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-stateful-"));
  const fixture = path.join(dir, "stateful-controls.html");
  fs.writeFileSync(fixture, `<!doctype html><html><body>
    <label><input id="cb" type="checkbox"> RumiAI physical checkbox</label>
    <fieldset><legend>RumiAI physical choice</legend>
      <label><input type="radio" name="choice" value="a" checked> RumiAI physical option A</label>
      <label><input type="radio" name="choice" value="b"> RumiAI physical option B</label>
    </fieldset>
  </body></html>`, "utf8");

  const runtime = spawn(NODE, [path.join(ROOT, "runtime/src/cli.js")], {
    cwd:ROOT,
    env:{...process.env, RUMIAI_CC_SOCKET:SOCKET},
    stdio:["ignore", "pipe", "pipe"],
  });
  let client;
  try {
    await waitForRuntime(runtime);
    client = new ComputerControlClient({socketPath:SOCKET, timeoutMs:20000});
    await client.ensureReady();
    const opened = spawnSync("/usr/bin/open", ["-a", "Safari", fixture]);
    if (opened.status !== 0) throw new Error("could not open Safari fixture");
    await client.ensureApplicationReady({application:"Safari", timeoutMs:15000});

    const info = await client.runtimeInfo();
    for (const name of ["ui.toggle", "ui.select"]) {
      const capability = info.capabilities.find(item => item.name === name);
      check(`${name}-capability-present`, Boolean(capability));
      check(`${name}-capability-physically-validated`, capability?.validationState === "PHYSICALLY_VALIDATED");
    }

    const snapshot = await client.snapshot({application:"Safari", settle:true, compact:false});
    const checkbox = snapshot.nodes.find(node => node.role === "checkbox" && /RumiAI physical checkbox/i.test(node.name || ""));
    const radioB = snapshot.nodes.find(node => node.role === "radio-button" && /RumiAI physical option B/i.test(node.name || ""));
    check("fixture-checkbox-observed", Boolean(checkbox));
    check("fixture-radio-observed", Boolean(radioB));

    const beforeCheckbox = await client.describe({application:"Safari", target:checkbox});
    check("checkbox-state-observable", typeof beforeCheckbox.checked === "boolean");
    const requested = !beforeCheckbox.checked;
    const toggled = await client.toggle({application:"Safari", target:checkbox, value:requested});
    check("toggle-verified", toggled.verified === true && toggled.observedValue === requested);
    const idemToggle = await client.toggle({application:"Safari", target:toggled.target, value:requested});
    check("toggle-idempotent", idemToggle.verified === true && idemToggle.idempotent === true && idemToggle.changed === false);
    const restored = await client.toggle({application:"Safari", target:idemToggle.target, value:beforeCheckbox.checked});
    check("toggle-restored", restored.verified === true && restored.observedValue === beforeCheckbox.checked);

    const beforeRadio = await client.describe({application:"Safari", target:radioB});
    check("radio-selected-state-observable", typeof beforeRadio.selected === "boolean");
    const selected = await client.select({application:"Safari", target:radioB});
    check("select-verified", selected.verified === true && selected.observedValue === true);
    const idemSelect = await client.select({application:"Safari", target:selected.target});
    check("select-idempotent", idemSelect.verified === true && idemSelect.idempotent === true && idemSelect.changed === false);

    console.log("physical-native-control-stateful=PASS");
  } finally {
    try { if (client) await client.shutdownRuntime(); } catch (_) {}
    if (runtime.exitCode == null) runtime.kill("SIGTERM");
    try { spawnSync("/usr/bin/osascript", ["-e", 'tell application "Safari" to close front document']); } catch (_) {}
    try { fs.unlinkSync(fixture); } catch (_) {}
    try { fs.rmdirSync(dir); } catch (_) {}
  }
}

main().catch(error => {
  console.error("physical-native-control-stateful=BLOCKED");
  console.error(error.stack || error.message);
  process.exit(1);
});
