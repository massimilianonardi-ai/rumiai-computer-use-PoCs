"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="observeMenuExtras")return async()=>({state:"OBSERVED",menuExtras:{items:[]}});return async()=>({});}});}

test("Phase 9C3A router exposes global parameterless read-only menu-extras observation",async()=>{
  const route=createRouter(backend());
  await assert.rejects(route("menuExtras.observe",{application:"Finder"}),e=>e.code==="INVALID_MENU_EXTRAS_PARAMS");
  await assert.rejects(route("menuExtras.observe",{timeoutMs:1000}),e=>e.code==="INVALID_MENU_EXTRAS_PARAMS");
  const value=await route("menuExtras.observe",{});
  assert.equal(value.state,"OBSERVED");
  assert.deepEqual(value.menuExtras,{items:[]});
});

test("Phase 9C3A macOS helper is OS-owned native AX read-only observation",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-menu-extras-observation.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-menu-extras-observation.js"),"utf8");
  assert.match(helper,/com\.apple\.systemuiserver/);
  assert.match(helper,/com\.apple\.controlcenter/);
  assert.match(helper,/kAXExtrasMenuBarAttribute/);
  assert.match(helper,/kAXRoleAttribute/);
  assert.match(helper,/kAXSubroleAttribute/);
  assert.match(helper,/kAXTitleAttribute/);
  assert.match(helper,/kAXDescriptionAttribute/);
  assert.match(helper,/kAXValueAttribute/);
  assert.match(helper,/kAXEnabledAttribute/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent|keyCode|AppleScript|osascript/);
  assert.doesNotMatch(wrapper,/agent-ctrl|clipboard|keyboard|click|mouse/);
});

test("Phase 9C3A backend and public surfaces expose semantic menu-extra state only after promotion",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/menuExtras\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(source,/os-owned-native-AX-menu-extras-observation/);
  assert.match(source,/async observeMenuExtras/);
  const schema=JSON.stringify(JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/menu-extras-observe-result.schema.json"),"utf8")));
  for(const forbidden of["pid","AXUIElement","nativeRef","identifier","actions","coordinates","selector","url","bundleIdentifier","ownerBundleIdentifier"])assert.equal(schema.includes(forbidden),false,forbidden);
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/menu-extras-observe.params.schema.json"),"utf8"));
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties,{});
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const text of[sdk,types,adapter])assert.match(text,/observeMenuExtras/);
});

test("Phase 9C3A documentation records authoritative physical promotion and preserves mutation boundary",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-menu-extras.md"),"utf8");
  const discovery=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c23-system-chrome-discovery.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c3a-menu-extras-observation-physical.md"),"utf8");
  assert.match(docs,/Phase 9C3A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/5cc824a2209da7ad0de4feaa3cf0eff75ce42e55/);
  assert.match(docs,/34 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  assert.match(docs,/Phase 9C3A introduces no generic menu-extra invocation API/i);
  assert.match(docs,/delivery must not be reported as semantic success/i);
  assert.match(discovery,/cc-phase9c23-system-chrome-discovery-s01/);
  assert.match(evidence,/cc-phase9c3a-menu-extras-observation-s01/);
  assert.match(evidence,/5cc824a2209da7ad0de4feaa3cf0eff75ce42e55/);
  assert.match(evidence,/34 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 9C3A public result schema preserves anonymous semantic items",()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/menu-extras-observe-result.schema.json"),"utf8"));
  const item=schema.properties.menuExtras.oneOf.find(value=>value.type==="object").properties.items.items;
  assert.deepEqual(item.required,["title","description","value","enabled"]);
  assert.equal(item.additionalProperties,false);
  assert.deepEqual(item.properties.title.type,["string","null"]);
  assert.deepEqual(item.properties.description.type,["string","null"]);
  assert.deepEqual(item.properties.value.type,["string","null"]);
  assert.deepEqual(item.properties.enabled.type,["boolean","null"]);
  assert.equal(Object.prototype.hasOwnProperty.call(item.properties,"name"),false);
});
