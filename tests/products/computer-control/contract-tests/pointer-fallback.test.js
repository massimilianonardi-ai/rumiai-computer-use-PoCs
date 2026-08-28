"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router-low-level"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="movePointer")return async({display,x,y})=>({state:"MOVED",verified:true,display,position:{x,y},changed:true,idempotent:false,verification:{method:"quartz-current-pointer-location",evidence:{display,x,y}},backend:{name:"macos-quartz",strategy:"primary-display-pointer-move",fallback:true}});
  if(name==="clickPointer")return async({display,x,y,button})=>({state:"CLICK_POSTED",display,position:{x,y},button,positionVerified:true,buttonDelivery:"POSTED",semanticConsequenceVerified:false,verification:{positionMethod:"quartz-current-pointer-location",buttonMethod:"quartz-event-post-only"},backend:{name:"macos-quartz",strategy:"primary-display-pointer-click-post",fallback:true}});
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});
  return async()=>({});
}});}

test("Phase 10B router exposes narrow primary-display move/click only",async()=>{
  const route=createRouter(fixtureBackend());
  const moved=await route("pointer.move",{display:"primary",x:10,y:20});
  assert.equal(moved.state,"MOVED");assert.equal(moved.verified,true);
  const clicked=await route("pointer.click",{display:"primary",x:10,y:20,button:"left"});
  assert.equal(clicked.state,"CLICK_POSTED");assert.equal(clicked.semanticConsequenceVerified,false);
  for(const params of[{}, {display:"secondary",x:1,y:1}, {display:"primary",x:-1,y:1}, {display:"primary",x:1,y:NaN}, {display:"primary",x:1,y:1,index:0}])await assert.rejects(route("pointer.move",params));
  for(const params of[{display:"primary",x:1,y:1}, {display:"primary",x:1,y:1,button:"middle"}, {display:"primary",x:1,y:1,button:"left",clicks:2}])await assert.rejects(route("pointer.click",params));
});

test("Phase 10B native helper verifies position immediately before button post and reports posting only",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-pointer.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-pointer.js"),"utf8");
  assert.match(helper,/AXIsProcessTrusted/);
  assert.match(helper,/CGMainDisplayID/);
  assert.match(helper,/CGDisplayBounds/);
  assert.match(helper,/mouseType:\s*\.mouseMoved/);
  assert.match(helper,/\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/guard let positionedEvent = CGEvent\(source:\s*nil\)/);
  const positionedIndex=helper.indexOf("guard let positionedEvent");
  const downPostIndex=helper.indexOf("down.post(tap: .cghidEventTap)");
  assert.ok(positionedIndex>=0&&downPostIndex>positionedIndex,"position must be independently re-observed before button post");
  assert.match(helper,/"buttonDelivery": "POSTED"/);
  assert.match(helper,/"semanticConsequenceVerified": false/);
  assert.doesNotMatch(helper,/POINTER_CLICK_POSITION_UNVERIFIED|finalEvent/);
  assert.doesNotMatch(helper,/osascript|AppleScript|cliclick|CGRequestScreenCaptureAccess/);
  assert.match(wrapper,/"swiftc","-parse-as-library"/);
  assert.doesNotMatch(wrapper,/shell:true/);
});

test("Phase 10B backend lifecycle is IMPLEMENTED and click result cannot masquerade as semantic verification",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");
  assert.match(backend,/pointer\.move.*validationState:"IMPLEMENTED"/);
  assert.match(backend,/pointer\.click.*validationState:"IMPLEMENTED"/);
  assert.match(backend,/quartz-current-pointer-location/);
  assert.match(backend,/buttonDelivery:"POSTED"/);
  assert.match(backend,/semanticConsequenceVerified:false/);
  assert.doesNotMatch(backend,/pointer\.click.*PHYSICALLY_VALIDATED/);
  assert.doesNotMatch(backend,/semanticConsequenceVerified:true/);
});

test("Phase 10B schemas expose local coordinates and no native display identity",()=>{
  const files=["pointer-move.params.schema.json","pointer-move-result.schema.json","pointer-click.params.schema.json","pointer-click-result.schema.json"].map(name=>JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas",name),"utf8")));
  const text=JSON.stringify(files);
  assert.match(text,/primary/);assert.match(text,/CLICK_POSTED/);assert.match(text,/POSTED/);
  for(const forbidden of["CGDirectDisplayID","NSScreenNumber","displayID","nativeRef","globalDesktopId"])assert.equal(text.includes(forbidden),false,forbidden);
  const click=files[3];assert.equal(click.properties.semanticConsequenceVerified.const,false);assert.equal(click.properties.buttonDelivery.const,"POSTED");
});

test("Phase 10B SDK, declarations and RumiAI adapter are thin projections",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index-low-level.d.ts"),"utf8");
  const pkg=JSON.parse(fs.readFileSync(path.join(productRoot,"sdk/typescript/package.json"),"utf8"));
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[sdk,types,adapter]){assert.match(source,/movePointer/);assert.match(source,/clickPointer/);}
  assert.match(sdk,/pointer\.move/);assert.match(sdk,/pointer\.click/);assert.match(adapter,/pointer\.move/);assert.match(adapter,/pointer\.click/);
  assert.equal(pkg.types,"src/index-low-level.d.ts");
  assert.doesNotMatch(sdk,/pointer\.down|pointer\.up|pointer\.drag/);
});

test("Phase 10B docs preserve fallback and delivery-not-success boundaries",()=>{
  const api=fs.readFileSync(path.join(productRoot,"docs/api-pointer.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-delivery-discovery-physical.md"),"utf8");
  assert.match(api,/Phase 10B public API state: `IMPLEMENTED`/);
  assert.match(api,/buttonDelivery:\?\"?POSTED|buttonDelivery/);
  assert.match(api,/semanticConsequenceVerified:false|semanticConsequenceVerified/);
  assert.match(api,/does \*\*not\*\* claim semantic success/);
  assert.match(phase10,/Phase 10B pointer\s+IMPLEMENTED/);
  assert.match(phase10,/semantic capability always takes precedence/i);
  assert.match(evidence,/4c973a4400660417cfb39fb8297cd363e8c13c63/);
  assert.match(evidence,/phase10b-left-button-delivery=PASS down=1 up=1/);
  assert.match(evidence,/phase10b-right-button-delivery=PASS down=1 up=1/);
});
