#!/usr/bin/env node
"use strict";

/*
 * Physical promotion harness.
 *
 * This harness creates an isolated TextEdit fixture, launches the local runtime,
 * observes a fresh snapshot, resolves the editable surface by semantic role,
 * applies strict setText through the SDK, saves, closes, and removes the fixture.
 */

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
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-physical.sock";

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
    child.once("exit", code => {
      clearTimeout(timer);
      reject(new Error(`runtime exited before ready: ${code}`));
    });
  });
}

async function main() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-cc-physical-"));
  const fixturePath = path.join(fixtureDir, "computer-control-set-text.txt");
  const requested = "Ciao RumiAI.";
  fs.writeFileSync(fixturePath, "Initial fixture text", "utf8");

  const fixtureControl = require(BACKEND_PATH);
  const preparedRuntime = fixtureControl.ensureRuntime();
  if (!preparedRuntime.ok) throw new Error(preparedRuntime.detail || "runtime unavailable");
  const opened = spawnSync("/usr/bin/open", ["-a", "TextEdit", fixturePath]);
  if (opened.status !== 0) throw new Error("could not open isolated TextEdit fixture");
  const appReady = await fixtureControl.ensureReady("TextEdit");
  if (!appReady.ok) throw new Error(appReady.detail || "TextEdit fixture not ready");

  const runtime = spawn(NODE, [path.join(ROOT, "runtime/src/cli.js")], {
    cwd:ROOT,
    env:{...process.env, RUMIAI_CC_SOCKET:SOCKET, RUMIAI_CC_BACKEND_MODULE:BACKEND_PATH},
    stdio:["ignore", "pipe", "pipe"],
  });
  let failed = false;
  let client = null;
  let originalClipboard = null;
  try {
    await waitForRuntime(runtime);
    client = new ComputerControlClient({socketPath:SOCKET});
    const info = await client.runtimeInfo();
    const ready = await client.ensureReady();
    const applicationReady = await client.ensureApplicationReady({application:"TextEdit"});
    const foreground = await client.getForeground();
    const snapshot = await client.snapshot({application:"TextEdit", settle:true, compact:true});

    let editable = null;
    for (const role of ["text-area", "textarea", "text-field"]) {
      try {
        editable = await client.find({application:"TextEdit", role, snapshot:snapshot.snapshot});
        if (editable?.target?.ref) break;
      } catch (_) {}
    }
    if (!editable?.target?.ref) throw new Error("fresh snapshot exposed no editable semantic surface");

    const bounds = await client.getBounds({application:"TextEdit", target:editable.target});
    const before = await client.get({application:"TextEdit", target:editable.target, property:"text"});
    const focused = await client.focus({application:"TextEdit", target:editable.target});
    const clicked = await client.click({application:"TextEdit", target:editable.target, settle:true});
    const pressed = await client.press({application:"TextEdit", keys:"Right", settle:true});
    const beforeClearSnapshot = await client.snapshot({application:"TextEdit", settle:true, compact:true});
    const cleared = await client.clear({application:"TextEdit", target:editable.target});
    const changed = await client.waitUntilChanged({
      application:"TextEdit",
      previousSnapshot:beforeClearSnapshot.snapshot,
      compact:true,
    });
    const afterClear = await client.get({application:"TextEdit", target:editable.target, property:"text"});

    const result = await client.setText({
      application:"TextEdit",
      target:editable.target,
      text:requested,
    });
    const after = await client.get({application:"TextEdit", target:editable.target, property:"text"});
    originalClipboard = (await client.readClipboard()).text;
    const clipboardFixture = "RumiAI clipboard physical fixture";
    const clipboardWritten = await client.writeClipboard(clipboardFixture);
    const clipboardObserved = await client.readClipboard();
    await client.focus({application:"TextEdit", target:editable.target});
    await client.press({application:"TextEdit", keys:"Cmd+A", settle:false});
    const copied = await client.copy();
    const copiedObserved = await client.readClipboard();
    await client.clear({application:"TextEdit", target:editable.target});
    const pasted = await client.paste();
    const stable = await client.waitStable({application:"TextEdit"});
    const afterPaste = await client.get({application:"TextEdit", target:editable.target, property:"text"});
    await client.writeClipboard(originalClipboard);
    originalClipboard = null;

    console.log(`runtime-info=${info.contractVersion === "0.8.0" ? "PASS" : "FAIL"}`);
    console.log(`runtime-ready=${ready.verified === true ? "PASS" : "FAIL"}`);
    console.log(`application-ready=${applicationReady.verified === true ? "PASS" : "FAIL"}`);
    console.log(`foreground-textedit=${/textedit/i.test(foreground.application.name) ? "PASS" : "FAIL"}`);
    console.log(`snapshot-observed=${snapshot.state === "OBSERVED" ? "PASS" : "FAIL"}`);
    console.log(`editable-ref-fresh=${/^@e\d+$/.test(editable.target.ref) ? "PASS" : "FAIL"}`);
    console.log(`editable-role=${editable.target.role}`);
    console.log(`bounds-observed=${bounds.bounds && Number.isFinite(bounds.bounds.x) ? "PASS" : "FAIL"}`);
    console.log(`text-before-observed=${typeof before.value === "string" ? "PASS" : "FAIL"}`);
    console.log(`focus-delivered=${focused.verified === true ? "PASS" : "FAIL"}`);
    console.log(`click-delivered=${clicked.verified === true ? "PASS" : "FAIL"}`);
    console.log(`press-delivered=${pressed.verified === true ? "PASS" : "FAIL"}`);
    console.log(`clear-verified=${cleared.verified === true ? "PASS" : "FAIL"}`);
    console.log(`clear-empty-exact=${afterClear.value === "" ? "PASS" : "FAIL"}`);
    console.log(`state-changed=${changed.changed === true ? "PASS" : "FAIL"}`);
    console.log(`set-text-state=${result.state}`);
    console.log(`set-text-verified=${result.verified === true}`);
    console.log(`set-text-verification=${result.verification?.method || "none"}`);
    console.log(`text-after-exact=${after.value === requested ? "PASS" : "FAIL"}`);
    console.log(`clipboard-write-exact=${clipboardWritten.verified === true && clipboardObserved.text === clipboardFixture ? "PASS" : "FAIL"}`);
    console.log(`clipboard-copy-exact=${copied.verified === true && copiedObserved.text === requested ? "PASS" : "FAIL"}`);
    console.log(`clipboard-paste-exact=${pasted.verified === true && afterPaste.value === requested ? "PASS" : "FAIL"}`);
    console.log(`state-stable=${stable.state === "STABLE" ? "PASS" : "FAIL"}`);
    const pass =
      applicationReady.verified === true &&
      /textedit/i.test(foreground.application.name) &&
      bounds.bounds &&
      focused.verified === true &&
      clicked.verified === true &&
      pressed.verified === true &&
      cleared.verified === true &&
      afterClear.value === "" &&
      changed.changed === true &&
      result.verified === true &&
      result.verification?.method === "ax-text-exact" &&
      after.value === requested &&
      clipboardWritten.verified === true &&
      clipboardObserved.text === clipboardFixture &&
      copied.verified === true &&
      copiedObserved.text === requested &&
      pasted.verified === true &&
      afterPaste.value === requested &&
      stable.state === "STABLE";
    console.log(`physical-runtime-snapshot-find-set-text=${pass ? "PASS" : "FAIL"}`);
    failed = !pass;
  } finally {
    if (client && originalClipboard !== null) {
      try { await client.writeClipboard(originalClipboard); } catch (_) {}
    }
    try { fixtureControl.press({app:"TextEdit", keys:"Cmd+S", settle:true}); } catch (_) {}
    try { fixtureControl.press({app:"TextEdit", keys:"Cmd+W", settle:true}); } catch (_) {}
    runtime.kill("SIGTERM");
    await new Promise(resolve => runtime.once("exit", resolve));
    try { fixtureControl.shutdownRuntime(); } catch (_) {}
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
    if (fs.existsSync(fixtureDir)) fs.rmdirSync(fixtureDir);
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => {
  console.error(`physical-runtime-set-text=BLOCKED`);
  console.error(error.message);
  process.exit(1);
});
