#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const ROOT = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const NODE = process.env.RUMIAI_CC_NODE || process.execPath;
const BACKEND_PATH = process.env.RUMIAI_CC_BACKEND_MODULE || path.join(
  ROOT,
  "backends/macos/runtime/app/computer-control/index.js"
);
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-invoke-physical.sock";
const {ComputerControlClient} = require(path.join(ROOT, "sdk/typescript/src"));

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

function check(label, condition) {
  console.log(`${label}=${condition ? "PASS" : "FAIL"}`);
  if (!condition) throw new Error(label);
}

async function expectCode(call, code) {
  try {
    await call();
    return false;
  } catch (error) {
    return error.code === code && error.recoveryPolicy === "NONE";
  }
}

async function main() {
  if (process.platform !== "darwin") throw new Error("macOS physical test required");

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-control-invoke-"));
  const fixturePath = path.join(fixtureDir, "native-control-invoke.txt");
  fs.writeFileSync(fixturePath, "Native control invocation fixture", "utf8");

  const fixtureControl = require(BACKEND_PATH);
  const readyRuntime = fixtureControl.ensureRuntime();
  if (!readyRuntime.ok) throw new Error(readyRuntime.detail || "backend runtime unavailable");
  if (spawnSync("/usr/bin/open", ["-a", "TextEdit", fixturePath]).status !== 0) {
    throw new Error("could not open TextEdit fixture");
  }
  const readyApplication = await fixtureControl.ensureReady("TextEdit");
  if (!readyApplication.ok) throw new Error(readyApplication.detail || "TextEdit fixture not ready");

  const runtime = spawn(NODE, [path.join(ROOT, "runtime/src/cli.js")], {
    cwd:ROOT,
    env:{...process.env, RUMIAI_CC_SOCKET:SOCKET, RUMIAI_CC_BACKEND_MODULE:BACKEND_PATH},
    stdio:["ignore", "pipe", "pipe"],
  });

  let client = null;
  try {
    await waitForRuntime(runtime);
    client = new ComputerControlClient({socketPath:SOCKET, timeoutMs:20000});
    await client.ensureReady();
    await client.ensureApplicationReady({application:"TextEdit"});

    const info = await client.runtimeInfo();
    const capability = info.capabilities.find(item => item.name === "ui.invoke");
    check("invoke-capability-present", Boolean(capability));
    check("invoke-capability-available", capability?.available === true);
    check("invoke-capability-physically-validated", capability?.validationState === "PHYSICALLY_VALIDATED");

    const documentSnapshot = await client.snapshot({application:"TextEdit", settle:true, compact:false});
    const textTarget = documentSnapshot.nodes.find(node => node.role === "text-field");
    check("non-invokable-text-field-observed", Boolean(textTarget));
    check(
      "non-invokable-role-fails-closed",
      await expectCode(
        () => client.invoke({application:"TextEdit", target:textTarget}),
        "UNSUPPORTED_CONTROL_ROLE"
      )
    );

    await client.press({application:"TextEdit", keys:"Cmd+F", settle:true});
    const before = await client.snapshot({application:"TextEdit", settle:true, compact:false});
    const doneButton = before.nodes.find(
      node => node.role === "button" && /^(done|fine)$/i.test(String(node.name || "").trim())
    );
    const disabledButton = before.nodes.find(node => node.role === "button" && node.disabled === true);
    check("native-dialog-button-observed", Boolean(doneButton));
    check("disabled-button-observed", Boolean(disabledButton));

    const description = await client.describe({application:"TextEdit", target:doneButton});
    check("invoke-target-role-reobserved", description.target.role === "button");
    check("invoke-target-enabled", description.enabled === true);
    check("invoke-target-visible", description.visible === true);
    check(
      "disabled-control-fails-closed",
      await expectCode(
        () => client.invoke({application:"TextEdit", target:disabledButton}),
        "CONTROL_DISABLED"
      )
    );
    check(
      "stale-control-fails-closed",
      await expectCode(
        () => client.invoke({application:"TextEdit", target:{ref:"@e999999"}}),
        "CONTROL_DESCRIPTION_FAILED"
      )
    );

    const invoked = await client.invoke({application:"TextEdit", target:doneButton, settle:true});
    check("invoke-state", invoked.state === "INVOKED");
    check("invoke-delivery-verified", invoked.verified === true);
    check("invoke-target-role", invoked.target.role === "button");
    check("invoke-native-primary-action", invoked.verification.method === "native-primary-action-delivered");
    check("invoke-semantic-consequence-not-invented", invoked.semanticConsequenceVerified === false);
    check("invoke-native-strategy", invoked.backend.strategy === "ax-press" || invoked.backend.strategy === "ax-bounds-pointer");

    const after = await client.snapshot({application:"TextEdit", settle:true, compact:false});
    const doneStillPresent = after.nodes.some(
      node => node.role === "button" && /^(done|fine)$/i.test(String(node.name || "").trim())
    );
    check("caller-observed-semantic-consequence", after.snapshot !== before.snapshot && !doneStillPresent);
    console.log("physical-native-control-invoke=PASS");
  } finally {
    try {
      if (client) {
        await client.ensureApplicationReady({application:"TextEdit"});
        await client.press({application:"TextEdit", keys:"Cmd+W", settle:false});
        await client.shutdownRuntime();
      }
    } catch (_) {}
    if (runtime.exitCode == null) runtime.kill("SIGTERM");
    try { fixtureControl.shutdownRuntime(); } catch (_) {}
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
    if (fs.existsSync(fixtureDir)) fs.rmdirSync(fixtureDir);
  }
}

main().catch(error => {
  console.error("physical-native-control-invoke=BLOCKED");
  console.error(error.stack || error.message);
  process.exit(1);
});
