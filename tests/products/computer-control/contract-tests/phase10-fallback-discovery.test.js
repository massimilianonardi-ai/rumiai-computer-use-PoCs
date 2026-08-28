"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10-low-level-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10-low-level-discovery.js");

test("Phase 10 starts only after Phase 9D richer clipboard physical completion",()=>{
  const structure=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d2c-clipboard-typed-write-physical.md"),"utf8");
  assert.match(structure,/clipboard\.writeFormat.*PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D — displays and richer clipboard — COMPLETE/);
  assert.match(evidence,/358e22bca3b18bb835e91ae05fece1b3a757b722/);
  assert.match(evidence,/39 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 10 discovery is observation/probe only and does not deliver synthetic input or request screen permission",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/CGEvent\(source:\s*nil\)/);
  assert.match(helper,/\.location/);
  assert.match(helper,/\.unflippedLocation/);
  assert.match(helper,/NSEvent\.mouseLocation/);
  assert.match(helper,/CGPreflightScreenCaptureAccess/);
  assert.match(helper,/AXIsProcessTrusted/);
  assert.match(helper,/CGEvent\(mouseEventSource:/);
  assert.match(helper,/CGEvent\(scrollWheelEvent2Source:/);
  assert.match(helper,/CGEvent\(keyboardEventSource:/);
  assert.doesNotMatch(helper,/\.post\(|CGEventPost|CGWarpMouseCursorPosition|CGAssociateMouseAndMouseCursorPosition|CGRequestScreenCaptureAccess|NSEvent\.mouseEvent|osascript|AppleScript/);
});

test("Phase 10 screen probe uses modern ScreenCaptureKit only after non-prompting preflight",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  const physical=fs.readFileSync(physicalPath,"utf8");
  assert.match(helper,/import ScreenCaptureKit/);
  assert.match(helper,/if screenCapturePreflight/);
  assert.match(helper,/SCShareableContent\.getExcludingDesktopWindows/);
  assert.match(helper,/SCContentFilter\(display:/);
  assert.match(helper,/SCScreenshotManager\.captureImage/);
  assert.match(helper,/ScreenCaptureKit\.SCScreenshotManager/);
  assert.doesNotMatch(helper,/CGDisplayCreateImage/);
  assert.match(physical,/-framework","ScreenCaptureKit"/);
  assert.match(physical,/screen-capture-api-mismatch/);
});

test("Phase 10 public low-level APIs remain absent until discovery fixes their semantics",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router.js"),"utf8")+"\n"+fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  for(const method of[
    "pointer.move","pointer.click","pointer.down","pointer.up","pointer.drag",
    "input.scroll","input.wheel","keyboard.key","display.capture","window.capture","ui.capture","ocr.read"
  ]) assert.equal(router.includes(`\"${method}\"`),false,method);
});

test("Phase 10 remains an explicit fallback layer and cannot weaken semantic APIs",()=>{
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  assert.match(roadmap,/Phase 10\s+low-level fallbacks\s+PENDING/);
  assert.match(roadmap,/These are fallbacks/);
  assert.match(roadmap,/working semantic operation always takes precedence/);
  assert.match(roadmap,/coordinate delivery is not itself semantic success/);
});
