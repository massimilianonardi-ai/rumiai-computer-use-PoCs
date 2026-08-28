"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runner = path.join(__dirname, "session-runner.sh");

test("Computer Use physical runner provides portable agent-ctrl explicitly", () => {
  const source = fs.readFileSync(runner, "utf8");
  assert.match(source, /AGENT_CTRL="\$\{AGENT_CTRL:-\/Volumes\/RumiAI\/rumiai-portable-runtime\/bin\/agent-ctrl\}"/);
  assert.match(source, /\[ -x "\$AGENT_CTRL" \].*portable agent-ctrl missing/);
  assert.match(source, /AGENT_CTRL='\$AGENT_CTRL'.*RUMIAI_COMPUTER_USE_ROOT/);
  assert.match(source, /agent_ctrl_present=true/);
});
