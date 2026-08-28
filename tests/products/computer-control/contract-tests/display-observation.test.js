"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const macBackend=require(path.join(productRoot,"backends/macos/backend"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="listDisplays")return async()=>({state:"OBSERVED",displays:[]});return async()=>({});}});}

test("Phase 9D1A router exposes global parameterless display observation",async()=>{
  const route=createRouter(backend());
  await assert.rejects(route("display.list",{application:"Finder"}),e=>e.code==="INVALID_DISPLAY_PARAMS");
  await assert.rejects(route("display.list",{id:1}),e=>e.code==="INVALID_DISPLAY_PARAMS");
  const value=await route("display.list",{});
  assert.equal(value.state,"OBSERVED");
  assert.deepEqual(value.displays,[]);
});

test("Phase 9D1A native helper is read-only AppKit/CoreGraphics display observation",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-display-observation.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-display-observation.js"),"utf8");
  assert.match(helper,/NSScreen\.screens/);
  assert.match(helper,/screen\.frame/);
  assert.match(helper,/screen\.visibleFrame/);
  assert.match(helper,/backingScaleFactor/);
  assert.match(helper,/CGDisplayRotation/);
  assert.match(helper,/CGDisplayIsBuiltin/);
  assert.match(helper,/CGDisplayIsActive/);
  assert.match(helper,/CGDisplayIsOnline/);
  assert.doesNotMatch(helper,/CGConfigureDisplay|CGBeginDisplayConfiguration|CGCompleteDisplayConfiguration|CGDisplaySet|CGDisplayMoveCursorToPoint|CGEvent|NSEvent|keyCode|NSPasteboard|osascript|AppleScript/);
  assert.doesNotMatch(wrapper,/agent-ctrl|clipboard|keyboard|click|mouse/);
});

test("Phase 9D1A canonicalization strips native display identity and fails closed on malformed geometry",()=>{
  const observed=macBackend.canonicalDisplay({
    displayID:99,
    name:"Reference",
    frame:{x:10,y:-20,width:1440,height:900},
    visibleFrame:{x:10,y:4,width:1440,height:850},
    backingScaleFactor:2,
    rotationDegrees:0,
    main:true,
    builtin:false,
    active:true,
    online:true,
    pixelWidth:2880,
    pixelHeight:1800,
  });
  assert.deepEqual(observed,{
    name:"Reference",
    bounds:{x:10,y:-20,width:1440,height:900},
    usableBounds:{x:10,y:4,width:1440,height:850},
    scale:2,
    rotationDegrees:0,
    primary:true,
    builtIn:false,
    active:true,
    online:true,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(observed,"displayID"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(observed,"pixelWidth"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(observed,"pixelHeight"),false);
  assert.throws(()=>macBackend.canonicalDisplay({...observed,frame:{x:0,y:0,width:-1,height:1},visibleFrame:{x:0,y:0,width:1,height:1},backingScaleFactor:1,rotationDegrees:0,main:true,builtin:true,active:true,online:true}),e=>e.code==="DISPLAY_OBSERVATION_INVALID_NATIVE_STATE");
});

test("Phase 9D1A public schema and surfaces expose semantic display state only",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/display\.list.*IMPLEMENTED/);
  assert.match(source,/os-owned-native-display-observation/);
  assert.match(source,/async listDisplays/);
  const schema=JSON.stringify(JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/display-list-result.schema.json"),"utf8")));
  for(const forbidden of["displayID","CGDirectDisplayID","pixelWidth","pixelHeight","nativeRef","handle","coordinates"])assert.equal(schema.includes(forbidden),false,forbidden);
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/display-list.params.schema.json"),"utf8"));
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties,{});
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const text of[sdk,types,adapter])assert.match(text,/listDisplays/);
});

test("Phase 9D1A documentation records discovery provenance without premature physical promotion",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-displays.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d-display-clipboard-discovery.md"),"utf8");
  assert.match(docs,/Phase 9D1A validation state: `IMPLEMENTED`/);
  assert.doesNotMatch(docs,/Phase 9D1A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/does not expose `CGDirectDisplayID`/);
  assert.match(docs,/does not expose a `pixelWidth` \/ `pixelHeight` claim/);
  assert.match(evidence,/c70e0e581c54ee67d9f56c4400ef3a942012629e/);
  assert.match(evidence,/generalPasteboardUnchanged: true/);
});
