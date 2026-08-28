"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const structure=require(path.join(productRoot,"backends/macos/backend-structure"));

const pngBytes=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from([1,2,3,4,5])]);
const pngBase64=pngBytes.toString("base64");

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="captureDisplay")return async({display})=>({state:"CAPTURED",display,format:"image/png",width:10,height:20,byteCount:pngBytes.length,dataBase64:pngBase64,cursorIncluded:false,observation:{method:"macos-screencapturekit-primary-display-png"},backend:{name:"macos-screencapturekit",strategy:"primary-display-single-frame-png"}});
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});
  return async()=>({});
}});}

test("Phase 10A router exposes only explicit primary display capture",async()=>{
  const route=createRouter(fixtureBackend());
  const value=await route("display.capture",{display:"primary"});
  assert.equal(value.state,"CAPTURED");
  assert.equal(value.display,"primary");
  for(const params of[
    {},
    {display:"secondary"},
    {display:0},
    {display:"primary",displayId:1},
    {display:"primary",index:0},
  ]) await assert.rejects(route("display.capture",params),error=>["INVALID_DISPLAY_CAPTURE_PARAMS","DISPLAY_SELECTOR_UNSUPPORTED"].includes(error.code));
});

test("Phase 10A native helper uses ScreenCaptureKit without prompting or persistence",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-display-capture.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-display-capture.js"),"utf8");
  assert.match(helper,/import ScreenCaptureKit/);
  assert.match(helper,/CGPreflightScreenCaptureAccess/);
  assert.match(helper,/SCShareableContent\.excludingDesktopWindows/);
  assert.match(helper,/SCContentFilter\(display:/);
  assert.match(helper,/SCScreenshotManager\.captureImage/);
  assert.match(helper,/configuration\.showsCursor\s*=\s*false/);
  assert.match(helper,/representation\(using:\s*\.png/);
  assert.match(helper,/maximumPNGBytes\s*=\s*20\s*\*\s*1024\s*\*\s*1024/);
  assert.doesNotMatch(helper,/CGDisplayCreateImage|CGRequestScreenCaptureAccess|CGWarpMouseCursorPosition|CGEventPost|\.post\(/);
  assert.doesNotMatch(helper,/write\(to:|writeToFile|FileManager\.default\.createFile/);
  assert.match(wrapper,/-framework","ScreenCaptureKit"/);
  assert.match(wrapper,/MAX_CAPTURE_BYTES=20\*1024\*1024/);
  assert.match(wrapper,/MAX_BUFFER_BYTES=32\*1024\*1024/);
  assert.doesNotMatch(wrapper,/shell:true|osascript|screencapture\s/);
});

test("Phase 10A backend validates canonical PNG payload and keeps native display identity private",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");
  const lifecycleLine=source.split("\n").find(line=>line.includes("LOW_LEVEL_FALLBACK_CAPABILITIES"))||"";
  assert.match(lifecycleLine,/display\.capture.*IMPLEMENTED/);
  assert.doesNotMatch(lifecycleLine,/PHYSICALLY_VALIDATED/);
  assert.match(source,/screencapturekit-primary-display-single-frame-png/);
  assert.match(source,/canonicalDisplayCapture/);
  assert.match(source,/PNG_SIGNATURE/);
  assert.match(source,/macos-screencapturekit/);
  const canonical=structure.canonicalDisplayCapture({state:"CAPTURED",display:"primary",format:"image/png",width:10,height:20,byteCount:pngBytes.length,dataBase64:pngBase64,cursorIncluded:false,method:"macos-screencapturekit-primary-display-png"});
  assert.equal(canonical.dataBase64,pngBase64);
  assert.equal(canonical.byteCount,pngBytes.length);
  assert.throws(()=>structure.canonicalDisplayCapture({state:"CAPTURED",display:"primary",format:"image/png",width:10,height:20,byteCount:3,dataBase64:Buffer.from([1,2,3]).toString("base64"),cursorIncluded:false,method:"macos-screencapturekit-primary-display-png"}),e=>e.code==="DISPLAY_CAPTURE_INVALID_NATIVE_STATE");
  assert.throws(()=>structure.canonicalDisplayCapture({state:"CAPTURED",display:"primary",format:"image/png",width:10,height:20,byteCount:pngBytes.length,dataBase64:pngBase64.replace(/=$/,""),cursorIncluded:false,method:"macos-screencapturekit-primary-display-png"}),e=>e.code==="DISPLAY_CAPTURE_INVALID_NATIVE_STATE");
});

test("Phase 10A schemas expose PNG bytes and image dimensions but no native display handle",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/display-capture.params.schema.json"),"utf8"));
  assert.deepEqual(params.required,["display"]);
  assert.equal(params.additionalProperties,false);
  assert.equal(params.properties.display.const,"primary");
  const result=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/display-capture-result.schema.json"),"utf8"));
  assert.equal(result.properties.state.const,"CAPTURED");
  assert.equal(result.properties.display.const,"primary");
  assert.equal(result.properties.format.const,"image/png");
  assert.equal(result.properties.byteCount.maximum,20971520);
  assert.equal(result.properties.dataBase64.contentEncoding,"base64");
  assert.equal(result.properties.cursorIncluded.const,false);
  assert.equal(result.additionalProperties,false);
  const text=JSON.stringify(result);
  for(const forbidden of["displayID","CGDirectDisplayID","NSScreenNumber","nativeRef","handle","physicalPixel"])assert.equal(text.includes(forbidden),false,forbidden);
});

test("Phase 10A SDK and RumiAI adapter are thin projections",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[sdk,types,adapter])assert.match(source,/captureDisplay/);
  assert.match(sdk,/display\.capture/);
  assert.match(adapter,/display\.capture/);
  assert.match(types,/display:"primary"/);
  assert.match(types,/DisplayCaptureResult/);
});

test("Phase 10A docs preserve fallback, privacy, permission and validation boundaries",()=>{
  const api=fs.readFileSync(path.join(productRoot,"docs/api-display-capture.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10-low-level-fallback-discovery-physical.md"),"utf8");
  assert.match(api,/Phase 10A state: `IMPLEMENTED`/);
  assert.match(api,/SCREEN_CAPTURE_PERMISSION_REQUIRED/);
  assert.match(api,/does \*\*not\*\* automatically request Screen Recording permission/);
  assert.match(api,/not persist/i);
  assert.match(api,/not a claim about physical panel pixels/);
  assert.match(phase10,/Phase 10A capture\s+IMPLEMENTED/);
  assert.match(phase10,/semantic capability always takes precedence/);
  assert.match(evidence,/ae385e0746d58bcf4c1c41ba6a8641fa8d258fc5/);
  assert.match(evidence,/40 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  assert.match(evidence,/constructibility only, not delivery/i);
});