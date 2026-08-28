"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10d-wheel-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10d-wheel-delivery-discovery.js");

test("Phase 10D remains rooted in authoritative Phase 10C validation and wheel discovery evidence",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");const evidence10c=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10c-pointer-drag-public-physical.md"),"utf8");const evidence10d=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-wheel-delivery-discovery-physical.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(backend,/pointer\.drag.*validationState:"PHYSICALLY_VALIDATED"/);assert.match(backend,/pointer\.wheel.*validationState:"IMPLEMENTED"/);assert.match(evidence10c,/1e0286c271cefddc36be7fc84008083d0658bd82/);assert.match(evidence10d,/6e63c9e1450db6b32510bb17250722bb3efc2f3b/);assert.match(evidence10d,/wheel1=-3.*increasing-y/);assert.match(evidence10d,/wheel1=\+3.*decreasing-y/);assert.match(phase10,/Phase 10D wheel\s+IMPLEMENTED/);
});

test("historical Phase 10D discovery delivered two opposite Quartz wheel signs to one test-owned AppKit scroll fixture",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/ProbeScrollView/);assert.match(helper,/override func scrollWheel/);assert.match(helper,/super\.scrollWheel\(with: event\)/);assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*-3/);assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*3/);assert.match(helper,/negative\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/positive\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/negativeCount >= 1/);assert.match(helper,/positiveCount >= 1/);
});

test("historical Phase 10D discovery required real scroll consequence, baseline reset and opposite direction mapping",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/documentVisibleRect\.origin\.y - baseline/);assert.match(helper,/abs\(negativeDelta\) >= 1/);assert.match(helper,/abs\(positiveDelta\) >= 1/);assert.match(helper,/let reset = setBaseline\(\)/);assert.match(helper,/abs\(reset - baseline\) <= 1/);assert.match(helper,/negativeDelta \* positiveDelta < 0/);assert.match(helper,/oppositeDirectionsObserved/);assert.doesNotMatch(helper,/semanticScrollClaimed": true/);
});

test("historical Phase 10D discovery remains fixture-owned, restores pointer/focus and persists no coordinates or offsets",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");const physical=fs.readFileSync(physicalPath,"utf8");assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);assert.match(helper,/previousApp\.activate/);assert.match(helper,/userContentTouched": false/);assert.match(physical,/"swiftc","-parse-as-library"/);assert.match(physical,/phase10d-wheel-pointer-restored/);assert.match(physical,/coordinatesLogged=false nativeDisplayIdsLogged=false offsetsLogged=false/);assert.doesNotMatch(physical,/baseline|negativeDelta|positiveDelta|targetX|targetY|originalX|originalY/);
});

test("Phase 10D public advancement exposes only pointer.wheel and keeps semantic ui.scroll preferred",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");assert.equal(router.includes('"pointer.wheel"'),true);for(const method of["input.scroll","input.wheel","wheel.post"]){assert.equal(router.includes(`\"${method}\"`),false,method);}const semantic=fs.readFileSync(path.join(productRoot,"backends/macos/backend-controls.js"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(semantic,/ui\.scroll|scroll/i);assert.match(phase10,/semantic `ui\.scroll` remains preferred/i);assert.match(phase10,/success state is `WHEEL_POSTED`/i);assert.match(phase10,/semanticConsequenceVerified.*always false/i);
});
