"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10b-pointer-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10b-pointer-delivery-discovery.js");

test("Phase 10B remains rooted in authoritative Phase 10A promotion and Phase 10B delivery evidence",()=>{
  const structure=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");
  const evidence10a=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10a-display-capture-physical.md"),"utf8");
  const evidence10b=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-delivery-discovery-physical.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  const lifecycleLine=structure.split("\n").find(line=>line.includes("LOW_LEVEL_FALLBACK_CAPABILITIES"))||"";
  assert.match(lifecycleLine,/display\.capture.*PHYSICALLY_VALIDATED/);
  assert.match(evidence10a,/4d215cace1cf30fa5837852e17dcb273f8e969c3/);
  assert.match(evidence10a,/ec3cd5f07defacdbe8b634a61b99d5510f77d832/);
  assert.match(evidence10b,/4c973a4400660417cfb39fb8297cd363e8c13c63/);
  assert.match(phase10,/Phase 10B pointer\s+IMPLEMENTED/);
});

test("Phase 10B discovery posts only into a test-owned AppKit fixture, pumps delivery, and restores pointer/focus",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/ProbeWindow/);
  assert.match(helper,/ProbeView/);
  assert.match(helper,/\.leftMouseDown/);
  assert.match(helper,/\.leftMouseUp/);
  assert.match(helper,/\.rightMouseDown/);
  assert.match(helper,/\.rightMouseUp/);
  assert.match(helper,/move\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/leftDown\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/rightDown\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/nextEvent\(matching:\s*\.any/);
  assert.match(helper,/app\.sendEvent\(event\)/);
  assert.match(helper,/pump\(app,\s*0\.22\)/);
  assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);
  assert.match(helper,/previousApp\.activate/);
  assert.match(helper,/func cleanup\(\) -> Bool/);
  assert.match(helper,/let restored = cleanup\(\)/);
  assert.doesNotMatch(helper,/osascript|AppleScript|systemEvents|cliclick/);
});

test("Phase 10B current public surface is only evidence-backed move/click and exposes no held-button API",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");
  assert.match(helper,/semanticConsequenceClaimed/);
  assert.match(helper,/"fixtureOwned": true/);
  assert.match(router,/pointer\.move/);
  assert.match(router,/pointer\.click/);
  for(const method of["pointer.down","pointer.up","pointer.button","pointer.drag"]){assert.equal(router.includes(`\"${method}\"`),false,method);}
});

test("Phase 10B physical harness compiles as library and logs no coordinates",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");
  assert.match(physical,/"swiftc","-parse-as-library"/);
  assert.match(physical,/phase10b-pointer-restored/);
  assert.match(physical,/phase10b-user-content-clicked/);
  assert.doesNotMatch(physical,/targetX|targetY|originalX|originalY|cursorX|cursorY/);
});

test("Phase 10B keeps semantic operations preferred over coordinate delivery",()=>{
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(phase10,/working semantic capability always takes precedence/i);
  assert.match(phase10,/primary-display local coordinates/i);
  assert.match(phase10,/must never replace a semantic target/i);
  assert.match(phase10,/does not mean the intended semantic action succeeded/i);
});
