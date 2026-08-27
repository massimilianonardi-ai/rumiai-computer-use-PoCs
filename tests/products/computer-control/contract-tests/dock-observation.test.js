"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="observeDock")return async()=>({state:"OBSERVED",dock:{items:[]}});return async()=>({});}});}

test("Phase 9C2A router exposes global parameterless read-only Dock observation",async()=>{
  const route=createRouter(backend());
  await assert.rejects(route("dock.observe",{application:"Finder"}),e=>e.code==="INVALID_DOCK_PARAMS");
  await assert.rejects(route("dock.observe",{timeoutMs:1000}),e=>e.code==="INVALID_DOCK_PARAMS");
  const value=await route("dock.observe",{});
  assert.equal(value.state,"OBSERVED");
  assert.deepEqual(value.dock,{items:[]});
});

test("Phase 9C2A macOS helper remains OS-owned native AX read-only observation",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-dock-observation.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-dock-observation.js"),"utf8");
  assert.match(helper,/com\.apple\.dock/);
  assert.match(helper,/kAXRoleAttribute/);
  assert.match(helper,/kAXSubroleAttribute/);
  assert.match(helper,/kAXTitleAttribute/);
  assert.match(helper,/AXIsApplicationRunning/);
  assert.match(helper,/AXStatusLabel/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent|keyCode|AppleScript|osascript/);
  assert.doesNotMatch(wrapper,/agent-ctrl|clipboard|keyboard|click|mouse/);
});

test("Phase 9C2A backend and public surfaces remain semantic after physical promotion",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/dock\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(source,/os-owned-native-AX-dock-observation/);
  assert.match(source,/async observeDock/);
  const schema=JSON.stringify(JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/dock-observe-result.schema.json"),"utf8")));
  for(const forbidden of["pid","AXUIElement","nativeRef","identifier","actions","coordinates","selector","url","bundleIdentifier"])assert.equal(schema.includes(forbidden),false,forbidden);
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/dock-observe.params.schema.json"),"utf8"));
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties,{});
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const text of[sdk,types,adapter])assert.match(text,/observeDock/);
});

test("Phase 9C2A documentation records authoritative physical promotion and immutable history",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-dock.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c2a-dock-observation-physical.md"),"utf8");
  assert.match(docs,/Phase 9C2A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/5662b659a3b80c236db323dfe09125b56b48eca6/);
  assert.match(docs,/33 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  assert.match(evidence,/cc-phase9c2a-dock-observation-s02/);
  assert.match(evidence,/b9d04f5213c5dcb00ca8dc0363f8248caa9a8916/);
  assert.match(evidence,/3da618a37d813d9cfc3e8003301388a03eea7b20/);
  assert.match(evidence,/Historical evidence is not rewritten/);
  assert.match(docs,/No generic Dock invocation API is introduced by Phase 9C2A/i);
});

test("Phase 9C2A public result schema remains stable semantic data",()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/dock-observe-result.schema.json"),"utf8"));
  const item=schema.properties.dock.oneOf.find(value=>value.type==="object").properties.items.items;
  assert.deepEqual(item.required,["kind","title","running","status"]);
  assert.deepEqual(item.properties.kind.enum,["application","folder","trash","separator","other"]);
  assert.equal(item.additionalProperties,false);
});
