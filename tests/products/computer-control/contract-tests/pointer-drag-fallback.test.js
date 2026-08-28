"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router-low-level"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="dragPointer")return async({display,source,destination,button})=>({state:"DRAG_POSTED",display,source,destination,button,sourcePositionVerified:true,buttonLifecycle:"POSTED",dragDelivery:"POSTED",releasePosted:true,semanticConsequenceVerified:false,verification:{sourcePositionMethod:"quartz-current-pointer-location",dragMethod:"quartz-event-post-only",releaseMethod:"quartz-left-mouse-up-post"},backend:{name:"macos-quartz",strategy:"primary-display-pointer-drag-post",fallback:true}});
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});return async()=>({});
}});}

test("Phase 10C router exposes one atomic primary-display left drag contract",async()=>{
  const route=createRouter(fixtureBackend());const value=await route("pointer.drag",{display:"primary",source:{x:10,y:20},destination:{x:30,y:40},button:"left"});assert.equal(value.state,"DRAG_POSTED");assert.equal(value.semanticConsequenceVerified,false);
  const bad=[{}, {display:"secondary",source:{x:1,y:1},destination:{x:2,y:2},button:"left"},{display:"primary",source:{x:-1,y:1},destination:{x:2,y:2},button:"left"},{display:"primary",source:{x:1,y:1},destination:{x:2,y:NaN},button:"left"},{display:"primary",source:{x:1,y:1},destination:{x:2,y:2},button:"right"},{display:"primary",source:{x:1,y:1,z:0},destination:{x:2,y:2},button:"left"},{display:"primary",source:{x:1,y:1},destination:{x:1,y:1},button:"left"},{display:"primary",source:{x:1,y:1},destination:{x:2,y:2},button:"left",duration:1}];for(const params of bad)await assert.rejects(route("pointer.drag",params));
});

test("Phase 10C helper owns source verification and complete preconstructed drag lifecycle",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-pointer.swift"),"utf8");const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-pointer.js"),"utf8");
  assert.match(helper,/request\.operation == "drag"/);assert.match(helper,/guard let positionedEvent = CGEvent\(source:\s*nil\)/);assert.match(helper,/\.leftMouseDown/);assert.match(helper,/\.leftMouseDragged/);assert.match(helper,/\.leftMouseUp/);assert.match(helper,/var draggedEvents: \[CGEvent\] = \[\]/);assert.match(helper,/Construct the complete lifecycle before posting the button-down event/);
  const dragStart=helper.indexOf('if request.operation == "drag"');const downConstruct=helper.indexOf("let down = CGEvent",dragStart);const upConstruct=helper.indexOf("let up = CGEvent",dragStart);const downPost=helper.indexOf("down.post(tap: .cghidEventTap)",dragStart);assert.ok(dragStart>=0&&downConstruct>dragStart&&upConstruct>downConstruct&&downPost>upConstruct,"all drag events must be constructed before button-down is posted");
  assert.match(helper,/"releasePosted": true/);assert.match(helper,/"emergencyReleasePosted": false/);assert.match(helper,/"semanticConsequenceVerified": false/);assert.match(wrapper,/const drag=/);assert.match(wrapper,/"swiftc","-parse-as-library"/);assert.doesNotMatch(wrapper,/shell:true/);
});

test("Phase 10C backend lifecycle is PHYSICALLY_VALIDATED and delivery cannot masquerade as semantic drop success",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");assert.match(backend,/pointer\.drag.*validationState:"PHYSICALLY_VALIDATED"/);assert.match(backend,/atomic-button-lifecycle/);assert.match(backend,/state:"DRAG_POSTED"/);assert.match(backend,/dragDelivery:"POSTED"/);assert.match(backend,/releasePosted:true/);assert.match(backend,/pointNear\(sourcePoint,source\)/);assert.match(backend,/pointNear\(destinationPoint,destination\)/);assert.match(backend,/semanticConsequenceVerified:false/);assert.doesNotMatch(backend,/semanticConsequenceVerified:true/);
});

test("Phase 10C schemas expose canonical logical points only",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/pointer-drag.params.schema.json"),"utf8"));const result=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/pointer-drag-result.schema.json"),"utf8"));const text=JSON.stringify([params,result]);assert.equal(params.additionalProperties,false);assert.equal(params.properties.button.const,"left");assert.equal(params.properties.source.additionalProperties,false);assert.equal(params.properties.destination.additionalProperties,false);assert.equal(result.properties.semanticConsequenceVerified.const,false);assert.equal(result.properties.dragDelivery.const,"POSTED");assert.equal(result.properties.releasePosted.const,true);for(const forbidden of["CGDirectDisplayID","NSScreenNumber","displayID","nativeRef","globalDesktopId","duration","steps","easing"])assert.equal(text.includes(forbidden),false,forbidden);
});

test("Phase 10C SDK declarations and RumiAI adapter are thin atomic projections with no held-button API",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index-low-level.d.ts"),"utf8");const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");for(const source of[sdk,types,adapter])assert.match(source,/dragPointer/);assert.match(sdk,/pointer\.drag/);assert.match(adapter,/pointer\.drag/);assert.match(types,/DRAG_POSTED/);for(const method of["pointer.down","pointer.up","pointer.button"]){assert.equal(router.includes(`\"${method}\"`),false,method);}assert.doesNotMatch(sdk,/pointer\.down|pointer\.up/);
});

test("Phase 10C docs record authoritative public validation and preserve delivery-not-success",()=>{
  const api=fs.readFileSync(path.join(productRoot,"docs/api-pointer.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10c-pointer-drag-public-physical.md"),"utf8");assert.match(api,/Phase 10C drag: `PHYSICALLY_VALIDATED`/);assert.match(api,/1e0286c271cefddc36be7fc84008083d0658bd82/);assert.match(api,/semanticConsequenceVerified.*false/);assert.match(phase10,/Phase 10C drag\/drop\s+PHYSICALLY_VALIDATED/);assert.match(phase10,/working semantic capability always takes precedence/i);assert.match(evidence,/mouseDragged\s+count=4/);assert.match(evidence,/no emergency release was required/i);assert.match(evidence,/user content was touched|no user content was touched/i);assert.match(evidence,/semanticConsequenceVerified = false|semanticConsequenceVerified.*false/);
});
