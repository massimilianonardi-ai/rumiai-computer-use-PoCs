"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const portableRoot = path.resolve(__dirname, "../../../../..");
const root = path.join(
  process.env.RUMIAI_COMPUTER_USE_ROOT || path.join(portableRoot, "app", "computer-use"),
  "app"
);
const wrapper = path.join(root, "computer-control-external.js");
const directConsumers = ["agent-loop.js", "executors.js", "recovery.js", "semantic-ui.js", "perception.js"];
const indirectPerceptionModules = ["perception-provider.js", "perception-target.js", "perception-action-policy.js"];
let failed = false;

function check(label, condition) {
  console.log(`${label}: ${condition ? "PASS" : "FAIL"}`);
  if (!condition) failed = true;
}

function checkNoBackendBypass(name, source) {
  check(`${name} no direct internal facade`, !source.includes('require("./computer-control")'));
  check(`${name} no direct agent-ctrl`, !source.includes('require("./agent-ctrl")'));
  check(`${name} no backend module paths`, !source.includes("computer-control/backends") && !source.includes("computer-control/desktop"));
}

check("external wrapper syntax", spawnSync(process.execPath, ["--check", wrapper]).status === 0);
const wrapperSource = fs.readFileSync(wrapper, "utf8");
check("external adapter environment override", wrapperSource.includes("RUMIAI_COMPUTER_CONTROL_ADAPTER"));
check("external installation home override", wrapperSource.includes("RUMIAI_COMPUTER_CONTROL_HOME"));
check("external wrapper has no development-volume path", !wrapperSource.includes("/Volumes/RumiAI"));
check("external wrapper has no user-profile install", !wrapperSource.includes('".local"') && !wrapperSource.includes("userInfo"));
check("external wrapper has no bundled fallback", !wrapperSource.includes('"bin"') && !wrapperSource.includes('"current"'));
check("bundled Computer Control source absent", !fs.existsSync(path.join(root, "computer-control")));
check("direct backend facade absent", !fs.existsSync(path.join(root, "agent-ctrl.js")));

for (const name of directConsumers) {
  const file = path.join(root, name);
  const source = fs.readFileSync(file, "utf8");
  check(`${name} syntax`, spawnSync(process.execPath, ["--check", file]).status === 0);
  check(`${name} uses external boundary`, source.includes('require("./computer-control-external")'));
  checkNoBackendBypass(name, source);
}

for (const name of indirectPerceptionModules) {
  const file = path.join(root, name);
  const source = fs.readFileSync(file, "utf8");
  check(`${name} syntax`, spawnSync(process.execPath, ["--check", file]).status === 0);
  check(`${name} does not call Computer Control directly`, !source.includes('require("./computer-control-external")'));
  checkNoBackendBypass(name, source);
}

console.log(`external-computer-control-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
