#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const ROOT = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const NODE = process.env.RUMIAI_CC_NODE || process.execPath;
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-scroll.sock";
const {ComputerControlClient} = require(path.join(ROOT, "sdk/typescript/src"));

class PhysicalAssertionError extends Error {}

function check(label, condition) {
  console.log(`${label}=${condition ? "PASS" : "FAIL"}`);
  if (!condition) throw new PhysicalAssertionError(label);
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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-scroll-"));
  const fixture = path.join(dir, "scroll-controls.html");
  fs.writeFileSync(fixture, `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>RumiAI scroll physical fixture</title>
  <style>
    body { margin: 0; font: 18px system-ui; }
    main { padding: 24px; }
    .space { height: 2200px; background: linear-gradient(#fff, #dcecff); }
    button { font: inherit; padding: 12px; }
  </style>
</head>
<body>
  <main>
    <button id="anchor" aria-label="RumiAI physical scroll anchor">RumiAI physical scroll anchor</button>
    <div class="space" aria-hidden="true"></div>
    <button id="target" aria-label="RumiAI physical offscreen target">RumiAI physical offscreen target</button>
    <div style="height:600px" aria-hidden="true"></div>
  </main>
</body>
</html>`, "utf8");

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
    for (const name of ["ui.scroll", "ui.scrollIntoView"]) {
      const capability = info.capabilities.find(item => item.name === name);
      check(`${name}-capability-present`, Boolean(capability));
      check(`${name}-capability-awaits-validation`, capability?.validationState === "IMPLEMENTED");
    }

    const snapshot = await client.snapshot({application:"Safari", settle:true, compact:false});
    const anchor = snapshot.nodes.find(node => /RumiAI physical scroll anchor/i.test(node.name || ""));
    const target = snapshot.nodes.find(node => /RumiAI physical offscreen target/i.test(node.name || ""));
    check("scroll-anchor-observed", Boolean(anchor));
    check("offscreen-target-observed", Boolean(target));

    const beforeTarget = await client.describe({application:"Safari", target});
    check("target-initially-not-visible", beforeTarget.visible === false);

    const scrolled = await client.scroll({application:"Safari", target:anchor, direction:"down", amount:1});
    check("scroll-postcondition", scrolled.verified === true && scrolled.verification?.evidence?.changed === true);

    const visible = await client.scrollIntoView({application:"Safari", target});
    check("scroll-into-view-postcondition", visible.verified === true && visible.verification?.evidence?.visible === true);

    const idempotent = await client.scrollIntoView({application:"Safari", target:visible.target});
    check("scroll-into-view-idempotent", idempotent.verified === true && idempotent.idempotent === true && idempotent.changed === false);

    console.log("physical-native-control-scroll=PASS");
  } finally {
    try { if (client) await client.shutdownRuntime(); } catch (_) {}
    if (runtime.exitCode == null) runtime.kill("SIGTERM");
    try { spawnSync("/usr/bin/osascript", ["-e", 'tell application "Safari" to close front document']); } catch (_) {}
    try { fs.rmSync(dir, {recursive:true}); } catch (_) {}
  }
}

main().catch(error => {
  console.error(`physical-native-control-scroll=${error instanceof PhysicalAssertionError ? "FAIL" : "BLOCKED"}`);
  console.error(error.stack || error.message);
  process.exit(1);
});

