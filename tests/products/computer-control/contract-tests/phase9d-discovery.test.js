"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase9d-display-clipboard-discovery.swift");

test("Phase 9D discovery starts after Phase 9C observation physical completion",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c3a-menu-extras-observation-physical.md"),"utf8");
  assert.match(backend,/menuExtras\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9C — system chrome — OBSERVATION COMPLETE/);
  assert.match(evidence,/5cc824a2209da7ad0de4feaa3cf0eff75ce42e55/);
  assert.match(evidence,/34 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 9D display discovery is read-only AppKit and CoreGraphics observation",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/NSScreen\.screens/);
  assert.match(helper,/CGMainDisplayID/);
  assert.match(helper,/CGDisplayPixelsWide/);
  assert.match(helper,/CGDisplayPixelsHigh/);
  assert.match(helper,/CGDisplayRotation/);
  assert.match(helper,/CGDisplayIsBuiltin/);
  assert.match(helper,/CGDisplayIsActive/);
  assert.match(helper,/CGDisplayIsOnline/);
  assert.doesNotMatch(helper,/CGConfigureDisplay|CGBeginDisplayConfiguration|CGCompleteDisplayConfiguration|CGDisplaySet|CGDisplayMoveCursorToPoint/);
});

test("Phase 9D clipboard discovery never mutates the user's general pasteboard",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/NSPasteboard\.general/);
  assert.match(helper,/NSPasteboard\.withUniqueName\(\)/);
  assert.match(helper,/generalPasteboardUnchanged/);
  assert.match(helper,/\.string/);
  assert.match(helper,/\.html/);
  assert.match(helper,/\.rtf/);
  assert.match(helper,/\.png/);
  assert.doesNotMatch(helper,/general\.clearContents|general\.declareTypes|general\.setString|general\.setData|NSPasteboard\.general\.clearContents|NSPasteboard\.general\.set/);
  assert.doesNotMatch(helper,/agent-ctrl|pbcopy|pbpaste|clipboard\s+write|CGEvent|NSEvent|keyCode|osascript|AppleScript/);
});

test("Phase 9D richer clipboard must extend rather than silently replace the existing text contract",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  const schema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard.params.schema.json"),"utf8"));
  assert.match(router,/case "clipboard\.read"/);
  assert.match(router,/case "clipboard\.write"/);
  assert.match(router,/case "clipboard\.copy"/);
  assert.match(router,/case "clipboard\.paste"/);
  assert.deepEqual(schema.required,["text"]);
  assert.equal(schema.properties.text.type,"string");
  assert.equal(schema.additionalProperties,false);
});

test("Phase 9D discovery remains historical provenance while public phases advance independently",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router.js"),"utf8");
  const core=fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  const source=router+"\n"+core;
  assert.match(source,/case"display\.list"/);
  assert.doesNotMatch(source,/display\.(?:configure|setMode|rotate|move|resize|capture|screenshot)/);
  assert.match(source,/case"clipboard\.observe"/);
  assert.match(source,/case"clipboard\.readFormat"/);
  assert.doesNotMatch(source,/clipboard\.(?:readRich|writeRich|observeFormats|listFormats|readTyped|writeTyped|writeFormat)/);
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d-display-clipboard-discovery.md"),"utf8");
  assert.match(evidence,/c70e0e581c54ee67d9f56c4400ef3a942012629e/);
  assert.match(evidence,/PHYSICALLY_VALIDATED_DISCOVERY/);
});
