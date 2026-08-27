"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="observeMenuBar")return async params=>({state:"OBSERVED",...params,menuBar:{items:[]}});return async()=>({});}});}

test("Phase 9C1A router exposes Provider-scoped read-only menu bar observation",async()=>{
  const route=createRouter(backend());
  await assert.rejects(route("menuBar.observe",{}),e=>e.code==="APP_REQUIRED");
  await assert.rejects(route("menuBar.observe",{application:"Fixture",timeoutMs:1000}),e=>e.code==="INVALID_MENU_BAR_PARAMS");
  const value=await route("menuBar.observe",{application:"Fixture"});
  assert.equal(value.application,"Fixture");
  assert.deepEqual(value.menuBar,{items:[]});
});

test("Phase 9C1A macOS helper is native AX read-only observation",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-menu-bar-observation.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-menu-bar-observation.js"),"utf8");
  assert.match(helper,/kAXMenuBarAttribute/);
  assert.match(helper,/kAXMenuBarRole/);
  assert.match(helper,/kAXMenuBarItemRole/);
  assert.match(helper,/kAXMenuItemRole/);
  assert.match(helper,/kAXEnabledAttribute/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent|keyCode|AppleScript|osascript/);
  assert.doesNotMatch(wrapper,/agent-ctrl|clipboard|keyboard|click|mouse/);
});

test("Phase 9C1A backend and public surfaces expose semantic tree only",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/menuBar\.observe.*IMPLEMENTED/);
  assert.match(source,/provider-scoped-native-AX-menu-bar-observation/);
  assert.match(source,/async observeMenuBar/);
  const schema=JSON.stringify(JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/menu-bar-observe-result.schema.json"),"utf8")));
  for(const forbidden of["pid","AXUIElement","nativeRef","identifier","actions","coordinates","selector","shortcut"])assert.equal(schema.includes(forbidden),false,forbidden);
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const text of[sdk,types,adapter])assert.match(text,/observeMenuBar/);
});

test("Phase 9C1A documentation records discovery and keeps invocation separate",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-menu-bar.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c1-menu-bar-discovery.md"),"utf8");
  assert.match(docs,/Phase 9C1A validation state: `IMPLEMENTED`/);
  assert.match(docs,/delivery is not success/i);
  assert.match(docs,/Phase 9C1B remains pending/);
  assert.match(evidence,/fe203eceec6a3976c911786860b8803794d6880a/);
  assert.match(evidence,/30 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 9C1A final fixture disables AppKit automatic menu enabling",()=>{
  const fixture=fs.readFileSync(path.join(__dirname,"../fixtures/macos-appkit-menu-bar-discovery/main.swift"),"utf8");
  assert.match(fixture,/actionsMenu\.autoenablesItems = false/);
  assert.match(fixture,/disabled\.isEnabled = false/);
  assert.match(fixture,/submenu\.autoenablesItems = false/);
});
