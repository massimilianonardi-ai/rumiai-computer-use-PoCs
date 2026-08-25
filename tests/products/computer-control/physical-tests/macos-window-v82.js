#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");
const portableRoot = path.resolve(__dirname, "../../../../../..");
const ROOT = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {ComputerControlClient} = require(path.join(ROOT, "sdk/typescript/src"));
const NODE = process.env.RUMIAI_CC_NODE || process.execPath;
const BACKEND_PATH = process.env.RUMIAI_CC_BACKEND_MODULE || path.join(
  ROOT,
  "backends/macos/runtime/app/computer-control/index.js"
);
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-window-physical.sock";

function waitForRuntime(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("runtime startup timeout")), 10000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.includes('"event":"runtime.ready"')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", code => reject(new Error(`runtime exited before ready: ${code}`)));
  });
}

async function main() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-cc-window-"));
  const fixturePath = path.join(fixtureDir, "computer-control-window-v82.txt");
  const survivorPath = path.join(fixtureDir, "computer-control-window-survivor.txt");
  const fixtureTitle = path.basename(fixturePath);
  fs.writeFileSync(fixturePath, "RumiAI Computer Control window fixture\n", "utf8");
  fs.writeFileSync(survivorPath, "RumiAI Computer Control survivor fixture\n", "utf8");

  const fixtureControl = require(BACKEND_PATH);
  if (!fixtureControl.ensureRuntime().ok) throw new Error("runtime unavailable");
  if (spawnSync("/usr/bin/open", ["-a", "TextEdit", survivorPath]).status !== 0) throw new Error("survivor open failed");
  if (spawnSync("/usr/bin/open", ["-a", "TextEdit", fixturePath]).status !== 0) throw new Error("fixture open failed");
  const ready = await fixtureControl.ensureReady("TextEdit");
  if (!ready.ok) throw new Error(ready.detail || "TextEdit not ready");

  const runtime = spawn(NODE, [path.join(ROOT, "runtime/src/cli.js")], {
    cwd:ROOT,
    env:{...process.env, RUMIAI_CC_SOCKET:SOCKET, RUMIAI_CC_BACKEND_MODULE:BACKEND_PATH},
    stdio:["ignore", "pipe", "pipe"],
  });

  let failed = false;
  let client = null;
  let target = null;
  let closed = false;
  try {
    await waitForRuntime(runtime);
    client = new ComputerControlClient({socketPath:SOCKET, timeoutMs:20000});
    await client.ensureReady();
    await client.ensureApplicationReady({application:"TextEdit"});

    const listed = await client.listWindows("TextEdit");
    target = listed.windows.find(window => window.title === fixtureTitle);
    if (!target) throw new Error("fixture window missing from window.list");
    console.log("stage-window-list=PASS");
    const current = await client.getCurrentWindow("TextEdit");
    console.log("stage-window-current=PASS");
    const focused = await client.focusWindow("TextEdit", target);
    console.log("stage-window-focus=PASS");
    const minimized = await client.minimizeWindow("TextEdit", target);
    console.log("stage-window-minimize=PASS");
    const restored = await client.restoreWindow("TextEdit", target);
    console.log("stage-window-restore=PASS");
    const moved = await client.moveWindow("TextEdit", target, {x:300, y:220});
    console.log("stage-window-move=PASS");
    const original = moved.previousBounds;
    if (!original) throw new Error("window.move did not expose previousBounds");
    const resized = await client.resizeWindow("TextEdit", target, {width:720, height:500});
    console.log("stage-window-resize=PASS");
    const maximized = await client.maximizeWindow("TextEdit", target);
    console.log("stage-window-maximize=PASS");
    const restoredPosition = await client.moveWindow("TextEdit", target, {x:original.x, y:original.y});
    console.log("stage-window-position-restore=PASS");
    const restoredSize = await client.resizeWindow("TextEdit", target, {width:original.width, height:original.height});
    console.log("stage-window-size-restore=PASS");
    const close = await client.closeWindow("TextEdit");
    console.log("stage-window-close=PASS");
    closed = close.verified === true;

    const checks = {
      "window-list":listed.windows.length > 0,
      "window-current":Boolean(current.window?.id),
      "window-focus":focused.verified === true,
      "window-minimize":minimized.verified === true,
      "window-restore":restored.verified === true,
      "window-move":moved.verified === true,
      "window-resize":resized.verified === true,
      "window-maximize":maximized.verified === true,
      "window-position-restored":restoredPosition.verified === true,
      "window-size-restored":restoredSize.verified === true,
      "window-close":closed,
    };
    for (const [name, pass] of Object.entries(checks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
    failed = Object.values(checks).some(pass => !pass);
    console.log(`physical-runtime-window-v82=${failed ? "FAIL" : "PASS"}`);
  } finally {
    if (!closed && target && client) {
      try { await client.focusWindow("TextEdit", target); } catch (_) {}
      try { await client.closeWindow("TextEdit"); } catch (_) {}
    }
    try { fixtureControl.press({app:"TextEdit", keys:"Cmd+W", settle:false}); } catch (_) {}
    runtime.kill("SIGTERM");
    await new Promise(resolve => runtime.once("exit", resolve));
    try { fixtureControl.shutdownRuntime(); } catch (_) {}
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
    if (fs.existsSync(survivorPath)) fs.unlinkSync(survivorPath);
    if (fs.existsSync(fixtureDir)) fs.rmdirSync(fixtureDir);
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => {
  console.error("physical-runtime-window-v82=BLOCKED");
  console.error(error.message);
  process.exit(1);
});
