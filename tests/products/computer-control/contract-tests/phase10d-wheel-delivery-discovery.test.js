"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10d-wheel-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10d-wheel-delivery-discovery.js");

test("Phase 10D remains rooted in discovery and authoritative public validation",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");const evidenceDiscovery=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-wheel-delivery-discovery-physical.md"),"utf8");const evidencePublic=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-pointer-wheel-public-physical.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(backend,/pointer\.wheel.*validationState:"PHYSICALLY_VALIDATED"/);assert.match(evidenceDiscovery,/6e63c9e1450db6b32510bb17250722bb3efc2f3b/);assert.match(evidencePublic,/b1ed223bb401ab79b5b7e6cc11c8512347afe0be/);assert.match(evidencePublic,/validated product: a3fcd4cbaa4f770e59bd974c0239b9af35701e99/);assert.match(phase10,/Phase 10D wheel\s+PHYSICALLY_VALIDATED/);
});

test("historical Phase 10D discovery delivered two opposite Quartz wheel signs to one test-owned AppKit scroll fixture",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/ProbeScrollView/);assert.match(helper,/override func scrollWheel/);assert.match(helper,/super\.scrollWheel\(with: event\)/);assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*-3/);assert.match(helper,/CGEvent\(scrollWheelEvent2Source:\s*nil, units:\s*\.line, wheelCount:\s*1, wheel1:\s*3/);assert.match(helper,/negative\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/positive\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/negativeCount >= 1/);assert.match(helper,/positiveCount >= 1/);
});

test("historical Phase 10D discovery required real scroll consequence and opposite mapping",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/documentVisibleRect\.origin\.y - baseline/);assert.match(helper,/negativeDelta \* positiveDelta < 0/);assert.match(helper,/oppositeDirectionsObserved/);assert.doesNotMatch(helper,/semanticScrollClaimed": true/);
});

test("historical Phase 10D discovery remains fixture-owned and private",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");const physical=fs.readFileSync(physicalPath,"utf8");assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);assert.match(helper,/previousApp\.activate/);assert.match(helper,/userContentTouched": false/);assert.match(physical,/coordinatesLogged=false nativeDisplayIdsLogged=false offsetsLogged=false/);
});

test("Phase 10D public advancement keeps semantic ui.scroll preferred",()=>{
  const semantic=fs.readFileSync(path.join(productRoot,"backends/macos/backend-controls.js"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(semantic,/ui\.scroll|scroll/i);assert.match(phase10,/semantic `ui\.scroll` remains preferred/i);assert.match(phase10,/success state is `WHEEL_POSTED`/i);assert.match(phase10,/semanticConsequenceVerified.*always false/i);
});
