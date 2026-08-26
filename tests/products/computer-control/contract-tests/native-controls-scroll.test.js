"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {createMacOSBackend} = require(path.join(productRoot, "backends/macos/backend"));
const {createRouter} = require(path.join(productRoot, "runtime/src/router"));

function backendModule({changed = true, descriptions = []} = {}) {
  let snapshotCount = 0;
  let descriptionCount = 0;
  return {
    snapshot() {
      snapshotCount += 1;
      return {
        ok:true,
        snapshot:snapshotCount === 1 ? '@e1 button "scroll anchor"' : '@e1 button "scroll anchor" [focused]',
        changed:snapshotCount === 1 ? null : changed,
        method:"fixture-accessibility-tree",
      };
    },
    focus({element}) {
      return {ok:true, verified:true, ref:element.ref, method:"fixture-focus"};
    },
    press({keys}) {
      return {ok:true, keys, method:"fixture-key-delivery"};
    },
    describe({element}) {
      const value = descriptions[Math.min(descriptionCount, descriptions.length - 1)] || {visible:true};
      descriptionCount += 1;
      return {
        ok:true,
        ref:element.ref,
        role:element.role || "button",
        name:element.name || "fixture target",
        visible:value.visible,
        method:"fixture-description",
      };
    },
  };
}

test("ui.scroll validates direction and bounded semantic pages", async () => {
  const route = createRouter({info:async () => ({}), scroll:async params => params});
  const target = {ref:"@e1", role:"button", name:"scroll anchor"};

  await assert.rejects(
    route("ui.scroll", {application:"Safari", target, direction:"left"}),
    error => error.code === "INVALID_SCROLL_DIRECTION" && error.recoveryPolicy === "NONE"
  );
  await assert.rejects(
    route("ui.scroll", {application:"Safari", target, direction:"down", amount:11}),
    error => error.code === "INVALID_SCROLL_AMOUNT" && error.recoveryPolicy === "NONE"
  );

  const routed = await route("ui.scroll", {application:"Safari", target, direction:"down", amount:2});
  assert.equal(routed.direction, "down");
  assert.equal(routed.amount, 2);
});

test("ui.scroll requires an observed Accessibility snapshot change", async () => {
  const target = {ref:"@e1", role:"button", name:"scroll anchor"};
  const verified = await createMacOSBackend({backendModule:backendModule({changed:true})})
    .scroll({application:"Safari", target, direction:"down", amount:1});

  assert.equal(verified.state, "SCROLLED");
  assert.equal(verified.verified, true);
  assert.equal(verified.verification.method, "accessibility-snapshot-changed");

  await assert.rejects(
    createMacOSBackend({backendModule:backendModule({changed:false})})
      .scroll({application:"Safari", target, direction:"down", amount:1}),
    error => error.code === "SCROLL_UNVERIFIED" && error.details?.state === "UNVERIFIED"
  );
});

test("ui.scrollIntoView requires visible true and preserves idempotence", async () => {
  const target = {ref:"@e2", role:"button", name:"offscreen target"};
  const changed = await createMacOSBackend({
    backendModule:backendModule({descriptions:[{visible:false}, {visible:true}]})
  }).scrollIntoView({application:"Safari", target});
  assert.equal(changed.state, "VISIBLE");
  assert.equal(changed.verified, true);
  assert.equal(changed.changed, true);
  assert.equal(changed.verification.evidence.visible, true);

  const idempotent = await createMacOSBackend({
    backendModule:backendModule({descriptions:[{visible:true}]})
  }).scrollIntoView({application:"Safari", target});
  assert.equal(idempotent.verified, true);
  assert.equal(idempotent.idempotent, true);
  assert.equal(idempotent.changed, false);
});

test("scroll validation states reflect physical evidence", async () => {
  const info = await createMacOSBackend({backendModule:backendModule()}).info();
  for (const name of ["ui.scroll", "ui.scrollIntoView"]) {
    const capability = info.capabilities.find(item => item.name === name);
    assert.ok(capability);
    assert.equal(capability.validationState, name === "ui.scroll" ? "PHYSICALLY_VALIDATED" : "IMPLEMENTED");
  }
});

test("schemas, SDK and RumiAI adapter expose both scroll APIs", () => {
  const scroll = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/scroll.params.schema.json"), "utf8"));
  const intoView = JSON.parse(fs.readFileSync(path.join(productRoot, "contract/schemas/scroll-into-view.params.schema.json"), "utf8"));
  const sdk = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.js"), "utf8");
  const types = fs.readFileSync(path.join(productRoot, "sdk/typescript/src/index.d.ts"), "utf8");
  const adapter = fs.readFileSync(path.join(productRoot, "adapters/rumiai/compat.js"), "utf8");

  assert.deepEqual(scroll.required, ["application", "target", "direction"]);
  assert.deepEqual(intoView.required, ["application", "target"]);
  assert.match(sdk, /scroll\(\{application, target, direction/);
  assert.match(sdk, /scrollIntoView\(\{application, target/);
  assert.match(types, /interface ScrollResult/);
  assert.match(types, /interface ScrollIntoViewResult/);
  assert.match(adapter, /ui\.scroll/);
  assert.match(adapter, /ui\.scrollIntoView/);
});
