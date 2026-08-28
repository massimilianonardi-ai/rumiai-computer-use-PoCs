"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10d-wheel-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10d-wheel-delivery-discovery.js");

test("Phase 10D starts only after authoritative public Phase 10C validation",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10c-pointer-drag-public-physical.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(backend,/pointer\.drag.*validationState:"PHYSICALLY_VALIDATED"/);
  assert.match(evidence,/1e0286c271cefddc36be7fc84008083d0658bd82/);
  assert.match(evidence,/validated product: 43a26d1f369c39dbed6ca8131af8d02bd8e17b47/);
  assert.match(phase10,/Phase 10D wheel\s+PENDING/);
});

test("Phase 10D discovery delivers two opposite Quartz wheel signs to one test-owned AppKit scroll fixture",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/ProbeScrollView/);
  assert.match(helper,/override func scrollWheel/);
  assert.match(helper,/super\.scrollWheel\(with: event\)/);
  assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*-3/);
  assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*3/);
  assert.match(helper,/negative\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/positive\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/negativeCount >= 1/);
  assert.match(helper,/positiveCount >= 1/);
});

test("Phase 10D discovery requires real scroll consequence, baseline reset and opposite direction mapping",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/documentVisibleRect\.origin\.y - baseline/);
  assert.match(helper,/abs\(negativeDelta\) >= 1/);
  assert.match(helper,/abs\(positiveDelta\) >= 1/);
  assert.match(helper,/let reset = setBaseline\(\)/);
  assert.match(helper,/abs\(reset - baseline\) <= 1/);
  assert.match(helper,/negativeDelta \* positiveDelta < 0/);
  assert.match(helper,/oppositeDirectionsObserved/);
  assert.doesNotMatch(helper,/semanticScrollClaimed": true/);
});

test("Phase 10D discovery is fixture-owned, restores pointer/focus and persists no coordinates or offsets",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  const physical=fs.readFileSync(physicalPath,"utf8");
  assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);
  assert.match(helper,/previousApp\.activate/);
  assert.match(helper,/userContentTouched": false/);
  assert.match(physical,/"swiftc","-parse-as-library"/);
  assert.match(physical,/phase10d-wheel-pointer-restored/);
  assert.match(physical,/coordinatesLogged=false nativeDisplayIdsLogged=false offsetsLogged=false/);
  assert.doesNotMatch(physical,/baseline|negativeDelta|positiveDelta|targetX|targetY|originalX|originalY/);
});

test("Phase 10D remains discovery-only and semantic ui.scroll stays preferred",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");
  for(const method of["input.scroll","input.wheel","pointer.wheel","wheel.post"]){assert.equal(router.includes(`\"${method}\"`),false,method);}
  const semantic=fs.readFileSync(path.join(productRoot,"backends/macos/backend-controls.js"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(semantic,/ui\.scroll|scroll/i);
  assert.match(phase10,/semantic `ui\.scroll` remains preferred/i);
  assert.match(phase10,/event posting alone is not success/i);
});
