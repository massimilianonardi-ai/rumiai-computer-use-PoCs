"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router-low-level"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="wheelPointer")return async({display,x,y,direction,amount})=>({state:"WHEEL_POSTED",display,position:{x,y},direction,amount,positionVerified:true,wheelDelivery:"POSTED",semanticConsequenceVerified:false,verification:{positionMethod:"quartz-current-pointer-location",wheelMethod:"quartz-event-post-only"},backend:{name:"macos-quartz",strategy:"primary-display-pointer-wheel-post",fallback:true}});
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});return async()=>({});
}});}

test("Phase 10D router exposes bounded canonical vertical pointer.wheel only",async()=>{
  const route=createRouter(fixtureBackend());const value=await route("pointer.wheel",{display:"primary",x:10,y:20,direction:"down",amount:3});assert.equal(value.state,"WHEEL_POSTED");assert.equal(value.direction,"down");assert.equal(value.amount,3);assert.equal(value.semanticConsequenceVerified,false);
  const bad=[{}, {display:"secondary",x:1,y:1,direction:"down",amount:1},{display:"primary",x:-1,y:1,direction:"down",amount:1},{display:"primary",x:1,y:NaN,direction:"down",amount:1},{display:"primary",x:1,y:1,direction:"left",amount:1},{display:"primary",x:1,y:1,direction:"up",amount:0},{display:"primary",x:1,y:1,direction:"up",amount:11},{display:"primary",x:1,y:1,direction:"up",amount:1.5},{display:"primary",x:1,y:1,direction:"up",amount:1,wheel1:1}];for(const params of bad)await assert.rejects(route("pointer.wheel",params));
});

test("Phase 10D native helper keeps discovered sign mapping private and verifies target position before wheel post",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-pointer.swift"),"utf8");const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-pointer.js"),"utf8");
  assert.match(helper,/request\.operation == "wheel"/);assert.match(helper,/direction == "up" \? amount : -amount/);assert.match(helper,/scrollWheelEvent2Source:\s*nil/);assert.match(helper,/units:\s*\.line/);assert.match(helper,/wheelCount:\s*1/);assert.match(helper,/wheel1:\s*nativeDelta/);assert.match(helper,/positionedEvent = CGEvent\(source:\s*nil\)/);const positioned=helper.indexOf("positionedEvent = CGEvent");const wheelBranch=helper.indexOf('request.operation == "wheel"');const wheelPost=helper.indexOf("wheel.post(tap: .cghidEventTap)",wheelBranch);assert.ok(positioned>=0&&wheelBranch>positioned&&wheelPost>wheelBranch,"target must be re-observed before wheel post");assert.match(helper,/"state": "WHEEL_POSTED"/);assert.match(helper,/"wheelDelivery": "POSTED"/);assert.match(helper,/"semanticConsequenceVerified": false/);assert.match(wrapper,/const wheel=/);assert.match(wrapper,/operation:"wheel"/);assert.doesNotMatch(wrapper,/shell:true/);
});

test("Phase 10D backend is IMPLEMENTED and rejects native semantic-success or canonical-request mismatch",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");assert.match(backend,/pointer\.wheel.*validationState:"IMPLEMENTED"/);assert.match(backend,/canonical-direction-private-native-sign/);assert.match(backend,/native\.state!=="WHEEL_POSTED"/);assert.match(backend,/native\.direction!==direction/);assert.match(backend,/native\.amount!==amount/);assert.match(backend,/pointNear\(position,\{x,y\}\)/);assert.match(backend,/wheelDelivery:"POSTED"/);assert.match(backend,/semanticConsequenceVerified:false/);assert.doesNotMatch(backend,/pointer\.wheel.*PHYSICALLY_VALIDATED/);assert.doesNotMatch(backend,/semanticConsequenceVerified:true/);
});

test("Phase 10D schemas expose canonical wheel vocabulary and no native wheel axes",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/pointer-wheel.params.schema.json"),"utf8"));const result=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/pointer-wheel-result.schema.json"),"utf8"));const text=JSON.stringify([params,result]);assert.equal(params.additionalProperties,false);assert.deepEqual(params.properties.direction.enum,["up","down"]);assert.equal(params.properties.amount.minimum,1);assert.equal(params.properties.amount.maximum,10);assert.equal(params.properties.amount.type,"integer");assert.equal(result.properties.state.const,"WHEEL_POSTED");assert.equal(result.properties.wheelDelivery.const,"POSTED");assert.equal(result.properties.semanticConsequenceVerified.const,false);for(const forbidden of["wheel1","wheel2","wheel3","nativeDelta","CGDirectDisplayID","NSScreenNumber","displayID","momentum","phase","pixel"]){assert.equal(text.includes(forbidden),false,forbidden);}
});

test("Phase 10D SDK and RumiAI adapter are thin canonical projections",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index-low-level.d.ts"),"utf8");const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");for(const source of[sdk,types,adapter])assert.match(source,/wheelPointer/);assert.match(sdk,/pointer\.wheel/);assert.match(adapter,/pointer\.wheel/);assert.match(types,/PointerWheelDirection = "up"\|"down"/);assert.match(types,/WHEEL_POSTED/);for(const source of[sdk,types,adapter])assert.doesNotMatch(source,/wheel1|wheel2|wheel3|nativeDelta/);
});

test("Phase 10D docs record authoritative delivery discovery and keep semantic ui.scroll preferred",()=>{
  const api=fs.readFileSync(path.join(productRoot,"docs/api-pointer.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-wheel-delivery-discovery-physical.md"),"utf8");assert.match(api,/Phase 10D public API state: `IMPLEMENTED`/);assert.match(api,/WHEEL_POSTED/);assert.match(api,/semanticConsequenceVerified.*false/);assert.match(phase10,/Phase 10D wheel\s+IMPLEMENTED/);assert.match(phase10,/semantic `ui\.scroll` remains preferred/i);assert.match(evidence,/6e63c9e1450db6b32510bb17250722bb3efc2f3b/);assert.match(evidence,/wheel1=-3.*increasing-y/);assert.match(evidence,/wheel1=\+3.*decreasing-y/);assert.match(evidence,/numeric scroll offsets were not persisted/i);
});
