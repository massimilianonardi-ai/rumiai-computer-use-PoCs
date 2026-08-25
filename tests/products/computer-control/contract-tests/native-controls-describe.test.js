"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {createRouter} = require(path.join(productRoot, "runtime/src/router"));

function backend() {
  return {
    info:async () => ({name:"fixture", version:"0.9.0", platform:"macos", capabilities:[]}),
    describe:async ({application, target}) => ({
      state:"DESCRIBED",
      target:{ref:target.ref, role:"checkbox", name:"Fixture"},
      description:null,
      value:null,
      valueType:"null",
      visible:true,
      enabled:true,
      focused:false,
      selected:null,
      checked:false,
      mixed:false,
      expanded:null,
      readOnly:null,
      required:null,
      range:null,
      actions:null,
      childCount:null,
      parentRole:null,
      bounds:{x:1,y:2,width:3,height:4},
      observation:{method:"fixture"},
      backend:{name:"fixture", strategy:"fixture"},
      application,
    }),
  };
}

test("ui.describe routes an actionable target without backend-specific fields", async () => {
  const result = await createRouter(backend())("ui.describe", {
    application:"Fixture",
    target:{ref:"@e7"},
  });
  assert.equal(result.state, "DESCRIBED");
  assert.equal(result.target.ref, "@e7");
  assert.equal(result.target.role, "checkbox");
  assert.equal(result.checked, false);
  assert.equal(result.actions, null);
  assert.equal("axRole" in result, false);
  assert.equal("nativeHandle" in result, false);
});

test("ui.describe rejects missing or malformed element handles before backend dispatch", async () => {
  const route = createRouter(backend());
  await assert.rejects(
    route("ui.describe", {application:"Fixture", target:{ref:"native-12"}}),
    error => error.code === "ACTIONABLE_ELEMENT_REQUIRED" && error.recoveryPolicy === "NONE"
  );
});

test("control description schema makes unavailable state explicit", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/control-description.schema.json"), "utf8"));
  const properties = schema.properties;
  for (const name of [
    "visible", "enabled", "focused", "selected", "checked", "mixed",
    "expanded", "readOnly", "required", "range", "actions", "childCount",
    "parentRole", "bounds",
  ]) {
    assert.ok(properties[name], `missing schema property ${name}`);
    assert.ok(schema.required.includes(name), `non-explicit schema property ${name}`);
  }
  assert.ok(schema.$defs.controlRole.enum.includes("checkbox"));
  assert.ok(schema.$defs.controlRole.enum.includes("slider"));
  assert.ok(schema.$defs.controlRole.enum.includes("date-time"));
  assert.ok(schema.$defs.controlAction.enum.includes("invoke"));
  assert.ok(schema.$defs.controlAction.enum.includes("toggle"));
  assert.ok(schema.$defs.controlAction.enum.includes("select"));
});

test("SDK and RumiAI adapter expose the canonical operation", () => {
  const sdk = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.js"), "utf8");
  const types = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.d.ts"), "utf8");
  const adapter = fs.readFileSync(path.join(productRoot, "adapters/rumiai/compat.js"), "utf8");
  assert.match(sdk, /describe\(\{application, target\}\)/);
  assert.match(sdk, /this\.call\("ui\.describe"/);
  assert.match(types, /interface ControlDescription/);
  assert.match(adapter, /safe\("ui\.describe"/);
});
