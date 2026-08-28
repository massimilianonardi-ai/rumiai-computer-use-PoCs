"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10b-pointer-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10b-pointer-delivery-discovery.js");

test("Phase 10B remains rooted in authoritative delivery discovery and public validation",()=>{
  const evidence10a=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10a-display-capture-physical.md"),"utf8");
  const evidenceDiscovery=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-delivery-discovery-physical.md"),"utf8");
  const evidencePublic=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-public-physical.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(evidence10a,/4d215cace1cf30fa5837852e17dcb273f8e969c3/);assert.match(evidenceDiscovery,/4c973a4400660417cfb39fb8297cd363e8c13c63/);assert.match(evidencePublic,/a7b878ff25e56ee7c16705dfdec1468f6a47b0a1/);assert.match(evidencePublic,/3f68502848f127d73f72cac023deed511f3ce75d/);assert.match(evidencePublic,/43 PASS \/ 0 FAIL \/ 0 BLOCKED/);assert.match(phase10,/Phase 10B pointer\s+PHYSICALLY_VALIDATED/);
});

test("Phase 10B discovery posts only into a test-owned AppKit fixture, pumps delivery, and restores pointer/focus",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/ProbeWindow/);assert.match(helper,/ProbeView/);assert.match(helper,/\.leftMouseDown/);assert.match(helper,/\.leftMouseUp/);assert.match(helper,/\.rightMouseDown/);assert.match(helper,/\.rightMouseUp/);assert.match(helper,/move\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/leftDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/rightDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/nextEvent\(matching:\s*\.any/);assert.match(helper,/app\.sendEvent\(event\)/);assert.match(helper,/pump\(app,\s*0\.22\)/);assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);assert.match(helper,/previousApp\.activate/);assert.match(helper,/func cleanup\(\) -> Bool/);assert.match(helper,/let restored = cleanup\(\)/);assert.doesNotMatch(helper,/osascript|AppleScript|systemEvents|cliclick/);
});

test("Phase 10B move/click remain public while 10C adds only atomic drag and no held-button API",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");
  for(const method of["pointer.move","pointer.click","pointer.drag"])assert.match(router,new RegExp(method.replace(".","\\.")));
  for(const method of["pointer.down","pointer.up","pointer.button"]){assert.equal(router.includes(`\"${method}\"`),false,method);}
});

test("Phase 10B physical harness compiles as library and logs no coordinates",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");assert.match(physical,/"swiftc","-parse-as-library"/);assert.match(physical,/phase10b-pointer-restored/);assert.match(physical,/phase10b-user-content-clicked/);assert.doesNotMatch(physical,/targetX|targetY|originalX|originalY|cursorX|cursorY/);
});

test("Phase 10B keeps semantic operations preferred over coordinate delivery",()=>{
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(phase10,/working semantic capability always takes precedence/i);assert.match(phase10,/primary-display-local/i);assert.match(phase10,/must never replace a semantic element target/i);assert.match(phase10,/buttonDelivery:\"POSTED\".*not as verified semantic success/i);assert.match(phase10,/semanticConsequenceVerified.*always false/i);
});
