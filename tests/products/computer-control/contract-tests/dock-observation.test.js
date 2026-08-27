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

test("Phase 9C2A macOS helper is OS-owned native AX read-only observation",()=>{
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

test("Phase 9C2A backend and public surfaces expose semantic Dock state only",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/dock\.observe.*IMPLEMENTED/);
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

test("Phase 9C2A documentation records discovery provenance without premature physical promotion",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-dock.md"),"utf8");
  const discovery=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c23-system-chrome-discovery.md"),"utf8");
  assert.match(docs,/Phase 9C2A validation state: `IMPLEMENTED`/);
  assert.doesNotMatch(docs,/Phase 9C2A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/generic Dock invocation API is introduced by Phase 9C2A/i);
  assert.match(docs,/delivery is represented as delivery rather than semantic success/i);
  assert.match(discovery,/cc-phase9c23-system-chrome-discovery-s01/);
  assert.match(discovery,/f68f5bc4bc3e2fec2aa1219b402b7016107a6e6f/);
  assert.match(discovery,/32 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  assert.match(discovery,/does not promote a public Dock or menu-extras capability to `PHYSICALLY_VALIDATED`/);
});

test("Phase 9C2A public result schema is stable semantic data",()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/dock-observe-result.schema.json"),"utf8"));
  const item=schema.properties.dock.oneOf.find(value=>value.type==="object").properties.items.items;
  assert.deepEqual(item.required,["kind","title","running","status"]);
  assert.deepEqual(item.properties.kind.enum,["application","folder","trash","separator","other"]);
  assert.equal(item.additionalProperties,false);
});
