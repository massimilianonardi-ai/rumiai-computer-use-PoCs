"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {createRouter} = require(path.join(productRoot, "runtime/src/router"));
const {createMacOSBackend} = require(path.join(productRoot, "backends/macos/backend"));
const operations = require(path.join(productRoot, "backends/macos/runtime/app/computer-control/operations"));
const agentCtrl = require(path.join(productRoot, "backends/macos/runtime/app/computer-control/backends/agent-ctrl"));

function fixtureRouterBackend() {
  return {
    info:async () => ({name:"fixture", version:"0.9.0", platform:"macos", capabilities:[]}),
    toggle:async ({target, value}) => ({state:"TOGGLED", verified:true, target, requestedValue:value, observedValue:value}),
    select:async ({target}) => ({state:"SELECTED", verified:true, target, observedValue:true}),
  };
}

test("ui.toggle requires an explicit boolean and routes the requested state", async () => {
  const route = createRouter(fixtureRouterBackend());
  await assert.rejects(
    route("ui.toggle", {application:"Safari", target:{ref:"@e1"}, value:"true"}),
    error => error.code === "BOOLEAN_VALUE_REQUIRED" && error.recoveryPolicy === "NONE"
  );
  const result = await route("ui.toggle", {application:"Safari", target:{ref:"@e1"}, value:true});
  assert.equal(result.state, "TOGGLED");
  assert.equal(result.requestedValue, true);
});

test("ui.select routes only an actionable ephemeral target", async () => {
  const route = createRouter(fixtureRouterBackend());
  await assert.rejects(
    route("ui.select", {application:"Safari", target:{ref:"persistent-id"}}),
    error => error.code === "ACTIONABLE_ELEMENT_REQUIRED"
  );
  const result = await route("ui.select", {application:"Safari", target:{ref:"@e2"}});
  assert.equal(result.state, "SELECTED");
  assert.equal(result.observedValue, true);
});

test("macOS mapping preserves verified stateful postconditions", async () => {
  const backend = createMacOSBackend({backendModule:{
    toggle:({element, value}) => ({
      ok:true, verified:true, state:"TOGGLED", ref:element.ref, role:"checkbox", name:"Fixture checkbox",
      previousValue:false, observedValue:value, changed:true, idempotent:false,
      verificationMethod:"accessibility-checked-postcondition", method:"ax-click",
    }),
    select:({element}) => ({
      ok:true, verified:true, state:"SELECTED", ref:element.ref, role:"radio-button", name:"Fixture radio",
      previousValue:false, observedValue:true, changed:true, idempotent:false,
      verificationMethod:"accessibility-selected-postcondition", method:"ax-click",
    }),
  }});

  const toggled = await backend.toggle({application:"Safari", target:{ref:"@e3"}, value:true});
  assert.equal(toggled.state, "TOGGLED");
  assert.equal(toggled.observedValue, true);
  assert.equal(toggled.verification.method, "accessibility-checked-postcondition");

  const selected = await backend.select({application:"Safari", target:{ref:"@e4"}});
  assert.equal(selected.state, "SELECTED");
  assert.equal(selected.observedValue, true);
  assert.equal(selected.verification.method, "accessibility-selected-postcondition");
});

test("macOS snapshot canonicalizes the native radio role", async () => {
  const backend = createMacOSBackend({backendModule:{
    snapshot:() => ({
      ok:true,
      snapshot:'@e4 radio "Fixture radio"',
      changed:null,
      method:"fixture-accessibility-tree",
    }),
  }});

  const observed = await backend.snapshot({application:"Safari", compact:false});
  assert.equal(observed.nodes.length, 1);
  assert.equal(observed.nodes[0].role, "radio-button");
});

test("macOS description decodes checked state and maps radio selection", () => {
  const originalGet = agentCtrl.getElementPropertyJson;
  const originalBounds = agentCtrl.getElementBounds;
  let role = "checkbox";
  let state = {checked:"false", selected:false, enabled:true, focused:false, visible:true};

  agentCtrl.getElementPropertyJson = (_ref, property) => ({
    ok:true,
    value:property === "role" ? role
      : property === "name" ? "Fixture control"
      : property === "value" ? "0"
      : property === "state" ? state
      : null,
    seconds:0,
  });
  agentCtrl.getElementBounds = () => ({ok:true, bounds:{x:1,y:2,w:3,h:4}, seconds:0});

  try {
    const checkbox = operations.describe({app:"Safari", element:{ref:"@e1"}});
    assert.equal(checkbox.checked, false);

    role = "radio";
    state = {checked:"true", selected:false, enabled:true, focused:false, visible:true};
    const radio = operations.describe({app:"Safari", element:{ref:"@e2"}});
    assert.equal(radio.role, "radio-button");
    assert.equal(radio.checked, true);
    assert.equal(radio.selected, true);
  } finally {
    agentCtrl.getElementPropertyJson = originalGet;
    agentCtrl.getElementBounds = originalBounds;
  }
});

test("physically observed stateful capabilities are promoted", async () => {
  const backend = createMacOSBackend({backendModule:{}});
  const info = await backend.info();
  for (const name of ["ui.toggle", "ui.select"]) {
    const capability = info.capabilities.find(item => item.name === name);
    assert.ok(capability);
    assert.equal(capability.validationState, "PHYSICALLY_VALIDATED");
  }
});

test("schemas, SDK, adapter and validation vocabulary expose toggle/select", () => {
  const toggle = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/toggle.params.schema.json"), "utf8"));
  const select = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/select.params.schema.json"), "utf8"));
  const common = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/common.schema.json"), "utf8"));
  const sdk = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.js"), "utf8");
  const types = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.d.ts"), "utf8");
  const adapter = fs.readFileSync(path.join(productRoot, "adapters/rumiai/compat.js"), "utf8");

  assert.deepEqual(toggle.required, ["application", "target", "value"]);
  assert.deepEqual(select.required, ["application", "target"]);
  assert.ok(common.$defs.validationState.enum.includes("IMPLEMENTED"));
  assert.match(sdk, /toggle\(\{application, target, value/);
  assert.match(sdk, /select\(\{application, target/);
  assert.match(types, /interface ToggleResult/);
  assert.match(types, /interface SelectResult/);
  assert.match(adapter, /ui\.toggle/);
  assert.match(adapter, /ui\.select/);
});
