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
const SOCKET = process.env.RUMIAI_CC_SOCKET || "/tmp/rumiai-computer-control-describe-physical.sock";
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

function finiteBounds(bounds) {
  return Boolean(bounds) && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite);
}

async function main() {
  if (process.platform !== "darwin") throw new Error("macOS physical test required");

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-control-describe-"));
  const fixturePath = path.join(fixtureDir, "native-control-description.txt");
  fs.writeFileSync(fixturePath, "Native control description fixture", "utf8");

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
    check("development-contract-version", info.contractVersion === "0.9.0");
    const capability = info.capabilities.find(item => item.name === "ui.describe");
    check("describe-capability-present", Boolean(capability));
    check("describe-capability-available", capability?.available === true);
    check("describe-capability-physically-validated", capability?.validationState === "PHYSICALLY_VALIDATED");

    const snapshot = await client.snapshot({application:"TextEdit", settle:true, compact:false});
    const textTarget = snapshot.nodes.find(node => node.role === "text-field");
    const buttonTarget = snapshot.nodes.find(node => node.role === "button" && !node.disabled);
    const sliderTarget = snapshot.nodes.find(node => node.role === "slider");
    check("text-field-observed", Boolean(textTarget));
    check("button-observed", Boolean(buttonTarget));
    check("slider-observed", Boolean(sliderTarget));

    const text = await client.describe({application:"TextEdit", target:textTarget});
    check("text-field-role", text.target.role === "text-field");
    check("text-field-visible", text.visible === true);
    check("text-field-enabled", text.enabled === true);
    check("text-field-focused-observable", typeof text.focused === "boolean");
    check("text-field-unavailable-checked-null", text.checked === null);
    check("text-field-unavailable-selected-null", text.selected === null);
    check("text-field-unavailable-actions-null", text.actions === null);
    check("text-field-unavailable-range-null", text.range === null);
    check("text-field-bounds", finiteBounds(text.bounds));

    const button = await client.describe({application:"TextEdit", target:buttonTarget});
    check("button-role", button.target.role === "button");
    check("button-enabled-observable", typeof button.enabled === "boolean");
    check("button-null-value", button.value === null && button.valueType === "null");
    check("button-bounds", finiteBounds(button.bounds));

    const slider = await client.describe({application:"TextEdit", target:sliderTarget});
    check("slider-role", slider.target.role === "slider");
    check("slider-number-value", slider.valueType === "number" && Number.isFinite(slider.value));
    check("slider-visible-observable", typeof slider.visible === "boolean");
    check("slider-enabled-observable", typeof slider.enabled === "boolean");
    check("slider-range-unobservable", slider.range === null);

    let staleRejected = false;
    try {
      await client.describe({application:"TextEdit", target:{ref:"@e999999", role:"unknown", name:""}});
    } catch (error) {
      staleRejected = error.code === "CONTROL_DESCRIPTION_FAILED";
    }
    check("stale-element-fails-closed", staleRejected);
    console.log("physical-native-control-describe=PASS");
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
  console.error("physical-native-control-describe=BLOCKED");
  console.error(error.stack || error.message);
  process.exit(1);
});
