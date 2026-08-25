"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {createRouter} = require(path.join(productRoot, "runtime/src/router"));
const {createMacOSBackend} = require(path.join(productRoot, "backends/macos/backend"));

function canonicalFixtureBackend() {
  return {
    info:async () => ({name:"fixture", version:"0.9.0", platform:"macos", capabilities:[]}),
    invoke:async ({target}) => ({
      ok:true,
      state:"INVOKED",
      verified:true,
      target:{ref:target.ref, role:"button", name:"Done"},
      semanticConsequenceVerified:false,
      verification:{method:"native-primary-action-delivered", evidence:{backendMethod:"fixture", role:"button"}},
      backend:{name:"macos-ax", strategy:"fixture", fallback:false},
      diagnostics:{actionSeconds:0, observeSeconds:0, totalSeconds:0},
    }),
  };
}

test("ui.invoke routes an actionable target and preserves delivery semantics", async () => {
  const result = await createRouter(canonicalFixtureBackend())("ui.invoke", {
    application:"TextEdit",
    target:{ref:"@e12", role:"button", name:"Done"},
    settle:true,
  });
  assert.equal(result.state, "INVOKED");
  assert.equal(result.verified, true);
  assert.equal(result.target.ref, "@e12");
  assert.equal(result.semanticConsequenceVerified, false);
  assert.equal(result.verification.method, "native-primary-action-delivered");
});

test("ui.invoke rejects missing or malformed element handles before dispatch", async () => {
  const route = createRouter(canonicalFixtureBackend());
  await assert.rejects(
    route("ui.invoke", {application:"TextEdit", target:{ref:"native-button-12"}}),
    error => error.code === "ACTIONABLE_ELEMENT_REQUIRED" && error.recoveryPolicy === "NONE"
  );
});

test("macOS mapping reports action delivery without inventing the semantic consequence", async () => {
  const backend = createMacOSBackend({
    backendModule:{
      invoke:({element}) => ({
        ok:true,
        ref:element.ref,
        role:"link",
        name:"Help",
        method:"ax-press",
        fallbackUsed:false,
        actionSeconds:0.01,
        observeSeconds:0.02,
        totalSeconds:0.03,
      }),
    },
  });
  const result = await backend.invoke({
    application:"TextEdit",
    target:{ref:"@e2", role:"button", name:"untrusted caller metadata"},
  });
  assert.equal(result.target.role, "link");
  assert.equal(result.target.name, "Help");
  assert.equal(result.semanticConsequenceVerified, false);
  assert.deepEqual(result.verification.evidence, {backendMethod:"ax-press", role:"link"});
});

test("macOS mapping keeps role, state and visibility failures distinct", async () => {
  for (const code of [
    "UNSUPPORTED_CONTROL_ROLE", "CONTROL_DISABLED", "CONTROL_NOT_VISIBLE",
    "CONTROL_STATE_UNAVAILABLE",
  ]) {
    const backend = createMacOSBackend({
      backendModule:{
        invoke:() => ({ok:false, state:"FAILED", error:code, detail:code, method:"accessibility-role-gate"}),
      },
    });
    await assert.rejects(
      backend.invoke({application:"TextEdit", target:{ref:"@e0"}}),
      error => error.code === code && error.recoveryPolicy === "NONE"
    );
  }
});

test("invoke schemas, SDK and RumiAI adapter expose the canonical operation", () => {
  const params = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/invoke.params.schema.json"), "utf8"));
  const result = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/invoke-result.schema.json"), "utf8"));
  const sdk = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.js"), "utf8");
  const types = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.d.ts"), "utf8");
  const adapter = fs.readFileSync(path.join(productRoot, "adapters/rumiai/compat.js"), "utf8");
  assert.deepEqual(params.required, ["application", "target"]);
  assert.equal(result.properties.state.const, "INVOKED");
  assert.equal(result.properties.semanticConsequenceVerified.const, false);
  assert.equal(result.properties.verification.properties.method.const, "native-primary-action-delivered");
  assert.match(sdk, /invoke\(\{application, target, settle = true\}\)/);
  assert.match(sdk, /this\.call\("ui\.invoke"/);
  assert.match(types, /interface InvokeResult/);
  assert.match(adapter, /action\("ui\.invoke"/);
});
