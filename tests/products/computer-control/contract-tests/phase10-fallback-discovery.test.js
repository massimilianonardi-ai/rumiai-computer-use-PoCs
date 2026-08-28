"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10-low-level-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10-low-level-discovery.js");

test("Phase 10 starts only after Phase 9D richer clipboard physical completion",()=>{
  const structure=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d2c-clipboard-typed-write-physical.md"),"utf8");
  assert.match(structure,/clipboard\.writeFormat.*PHYSICALLY_VALIDATED/);assert.match(roadmap,/Phase 9D — displays and richer clipboard — COMPLETE/);assert.match(evidence,/358e22bca3b18bb835e91ae05fece1b3a757b722/);assert.match(evidence,/39 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("historical Phase 10 discovery remains non-mutating provenance",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/CGEvent\(source:\s*nil\)/);assert.match(helper,/CGPreflightScreenCaptureAccess/);assert.match(helper,/CGEvent\(scrollWheelEvent2Source:/);assert.match(helper,/CGEvent\(keyboardEventSource:/);assert.doesNotMatch(helper,/\.post\(|CGEventPost|CGWarpMouseCursorPosition|CGRequestScreenCaptureAccess|osascript|AppleScript/);const physical=fs.readFileSync(physicalPath,"utf8");assert.match(physical,/physical-phase10-low-level-fallback-discovery=PASS/);
});

test("Phase 10 public surface advances only through implemented 10E keyboard",()=>{
  const router=["router.js","router-core.js","router-low-level.js"].map(name=>fs.readFileSync(path.join(productRoot,"runtime/src",name),"utf8")).join("\n");
  for(const method of["display.capture","pointer.move","pointer.click","pointer.drag","pointer.wheel","keyboard.press"])assert.equal(router.includes(`\"${method}\"`),true,method);
  for(const method of["pointer.down","pointer.up","pointer.button","input.scroll","input.wheel","wheel.post","keyboard.key","keyboard.type","keyboard.text","keyboard.down","keyboard.up","window.capture","ui.capture","ocr.read"])assert.equal(router.includes(`\"${method}\"`),false,method);
});

test("Phase 10 lifecycle validates through 10D and implements 10E without weakening semantic APIs",()=>{
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(roadmap,/Phase 10\s+low-level fallbacks\s+PENDING/);assert.match(roadmap,/working semantic operation always takes precedence/);assert.match(roadmap,/coordinate delivery is not itself semantic success/);
  assert.match(phase10,/Phase 10A capture\s+PHYSICALLY_VALIDATED/);assert.match(phase10,/Phase 10B pointer\s+PHYSICALLY_VALIDATED/);assert.match(phase10,/Phase 10C drag\/drop\s+PHYSICALLY_VALIDATED/);assert.match(phase10,/Phase 10D wheel\s+PHYSICALLY_VALIDATED/);assert.match(phase10,/Phase 10E keyboard\s+IMPLEMENTED/);assert.match(phase10,/semantic text mutation/i);
});
