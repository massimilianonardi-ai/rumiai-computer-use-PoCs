"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const root = __dirname;
const wrapper = path.join(root, "computer-control-external.js");
const consumers = ["agent-loop.js", "executors.js", "recovery.js", "semantic-ui.js"];
let failed = false;

function check(label, condition) {
  console.log(`${label}: ${condition ? "PASS" : "FAIL"}`);
  if (!condition) failed = true;
}

check("external wrapper syntax", spawnSync(process.execPath, ["--check", wrapper]).status === 0);
const wrapperSource = fs.readFileSync(wrapper, "utf8");
check("external adapter environment override", wrapperSource.includes("RUMIAI_COMPUTER_CONTROL_ADAPTER"));
check("external installation home override", wrapperSource.includes("RUMIAI_COMPUTER_CONTROL_HOME"));
check("external portable project default", wrapperSource.includes('"bin"') && wrapperSource.includes('"rumiai-computer-control"') && wrapperSource.includes('"current"'));
check("external wrapper has no development-volume path", !wrapperSource.includes("/Volumes/RumiAI"));
check("external wrapper has no user-profile install", !wrapperSource.includes('".local"') && !wrapperSource.includes("userInfo"));

for (const name of consumers) {
  const file = path.join(root, name);
  const source = fs.readFileSync(file, "utf8");
  check(`${name} syntax`, spawnSync(process.execPath, ["--check", file]).status === 0);
  check(`${name} uses external boundary`, source.includes('require("./computer-control-external")'));
  check(`${name} no direct internal facade`, !source.includes('require("./computer-control")'));
  check(`${name} no direct agent-ctrl`, !source.includes('require("./agent-ctrl")'));
}

console.log(`external-computer-control-boundary=${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
