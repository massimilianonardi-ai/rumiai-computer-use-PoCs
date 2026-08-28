"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router-low-level"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="pressKey")return async({key,modifiers})=>({state:"KEY_POSTED",key,modifiers,keyLifecycle:"POSTED",modifierLifecycle:modifiers.length?"POSTED":"NOT_REQUIRED",semanticConsequenceVerified:false,verification:{keyMethod:"quartz-keyboard-event-post-only",modifierMethod:modifiers.length?"quartz-modifier-event-post-only":"not-required"},backend:{name:"macos-quartz",strategy:"canonical-keyboard-press-post",fallback:true}});
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});return async()=>({});
}});}

test("Phase 10E router exposes only the three physically discovered keyboard.press tuples",async()=>{
  const route=createRouter(fixtureBackend());
  for(const params of[{key:"a",modifiers:[]},{key:"a",modifiers:["shift"]},{key:"enter",modifiers:[]}]){const value=await route("keyboard.press",params);assert.equal(value.state,"KEY_POSTED");assert.equal(value.semanticConsequenceVerified,false);}
  for(const params of[{}, {key:"b",modifiers:[]},{key:"enter",modifiers:["shift"]},{key:"a",modifiers:["command"]},{key:"a",modifiers:["shift","shift"]},{key:"a",modifiers:"shift"},{key:"a",modifiers:[],keyCode:0}])await assert.rejects(route("keyboard.press",params));
});

test("Phase 10E helper uses symbolic native identities privately, constructs the full lifecycle first, and settles modifier delivery",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-keyboard.swift"),"utf8");
  assert.match(helper,/Carbon\.HIToolbox/);assert.match(helper,/kVK_ANSI_A/);assert.match(helper,/kVK_Return/);assert.match(helper,/kVK_Shift/);
  assert.match(helper,/let keyDown = keyboardEvent/);assert.match(helper,/let keyUp = keyboardEvent/);assert.ok(helper.indexOf("let keyUp = keyboardEvent")<helper.indexOf("keyDown.post"));
  assert.match(helper,/shiftDown = keyboardEvent/);assert.match(helper,/shiftUp = keyboardEvent/);assert.ok(helper.indexOf("shiftUp = keyboardEvent")<helper.indexOf("shiftDown!.post"));
  assert.match(helper,/settleModifierDelivery/);assert.match(helper,/settleKeyDelivery/);assert.match(helper,/Thread\.sleep\(forTimeInterval:\s*0\.05\)/);assert.match(helper,/Thread\.sleep\(forTimeInterval:\s*0\.04\)/);
  const shiftPost=helper.indexOf("shiftDown!.post");const keyDownPost=helper.indexOf("keyDown.post");const keyUpPost=helper.indexOf("keyUp.post");const shiftUpPost=helper.indexOf("shiftUp!.post");
  assert.ok(shiftPost>=0&&keyDownPost>shiftPost&&keyUpPost>keyDownPost&&shiftUpPost>keyUpPost);
  assert.match(helper.slice(shiftPost,keyDownPost),/settleModifierDelivery\(\)/);assert.match(helper.slice(keyDownPost,keyUpPost),/settleKeyDelivery\(\)/);assert.match(helper.slice(keyUpPost,shiftUpPost),/settleKeyDelivery\(\)/);
  assert.doesNotMatch(helper,/virtualKey:\s*(?:0x[0-9A-Fa-f]+|[0-9]+)/);assert.match(helper,/semanticConsequenceVerified.*false/);
});

test("Phase 10E backend is IMPLEMENTED and fail-closed on lifecycle or semantic-success mismatch",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");
  assert.match(backend,/keyboard\.press.*validationState:"IMPLEMENTED"/);assert.match(backend,/private-native-keycodes/);assert.match(backend,/emergencyModifierReleasePosted!==false/);assert.match(backend,/semanticConsequenceVerified!==false/);assert.match(backend,/KEY_POSTED/);assert.doesNotMatch(backend,/keyboard\.press.*PHYSICALLY_VALIDATED/);
});

test("Phase 10E schemas and SDK expose no numeric keycode or held-key state",()=>{
  const params=fs.readFileSync(path.join(productRoot,"contract/schemas/keyboard-press.params.schema.json"),"utf8");const result=fs.readFileSync(path.join(productRoot,"contract/schemas/keyboard-press-result.schema.json"),"utf8");const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index-low-level.d.ts"),"utf8");const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[params,result,sdk,types,adapter])assert.doesNotMatch(source,/virtualKey|keyCode|scanCode|kVK_/);
  for(const source of[sdk,types,adapter])assert.match(source,/pressKey/);assert.match(sdk,/keyboard\.press/);assert.match(adapter,/keyboard\.press/);assert.match(result,/semanticConsequenceVerified/);assert.match(result,/false/);
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");for(const method of["keyboard.down","keyboard.up","keyboard.modifierDown","keyboard.modifierUp"]){assert.equal(router.includes(`\"${method}\"`),false,method);}
});

test("Phase 10E docs preserve semantic precedence and authoritative discovery provenance",()=>{
  const api=fs.readFileSync(path.join(productRoot,"docs/api-keyboard.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10e-keyboard-delivery-discovery-physical.md"),"utf8");
  assert.match(api,/public API state: `IMPLEMENTED`/);assert.match(api,/semantic Computer Control operation remains preferred/i);assert.match(phase10,/Phase 10E keyboard\s+IMPLEMENTED/);assert.match(evidence,/1aa6efa523dab83d7dd5e2b14fb1b6deb83dc324/);assert.match(evidence,/numeric virtual-key values are backend-private/i);
});
