"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10c-drag-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10c-drag-delivery-discovery.js");

test("Phase 10C starts only after authoritative public Phase 10B physical validation",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-public-physical.md"),"utf8");
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(backend,/pointer\.move.*PHYSICALLY_VALIDATED/);
  assert.match(backend,/pointer\.click.*PHYSICALLY_VALIDATED/);
  assert.match(evidence,/a7b878ff25e56ee7c16705dfdec1468f6a47b0a1/);
  assert.match(evidence,/43 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  assert.match(phase10,/Phase 10C drag\/drop\s+PENDING/);
});

test("Phase 10C discovery owns a complete left-button drag lifecycle inside one process",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/\.leftMouseDown/);
  assert.match(helper,/\.leftMouseDragged/);
  assert.match(helper,/\.leftMouseUp/);
  assert.match(helper,/buttonMayBeDown/);
  assert.match(helper,/down\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/dragged\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/up\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/emergencyUp\.post\(tap:\s*\.cghidEventTap\)/);
  assert.match(helper,/if buttonMayBeDown/);
  assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);
  assert.match(helper,/previousApp\.activate/);
  assert.doesNotMatch(helper,/osascript|AppleScript|cliclick|pointer\.down|pointer\.up/);
});

test("Phase 10C discovery requires independent AppKit drag consequence, not event construction alone",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");
  assert.match(helper,/final class MarkerView/);
  assert.match(helper,/override func hitTest\(_ point: NSPoint\) -> NSView\? \{ nil \}/);
  assert.match(helper,/override func mouseDown/);
  assert.match(helper,/override func mouseDragged/);
  assert.match(helper,/override func mouseUp/);
  assert.match(helper,/draggedCount/);
  assert.match(helper,/setMarkerCenter\(event\.locationInWindow\)/);
  assert.match(helper,/DRAG_FIXTURE_CONSEQUENCE_NOT_OBSERVED/);
  assert.match(helper,/fixtureConsequenceObserved/);
  assert.match(helper,/semanticConsequenceClaimed/);
});

test("Phase 10C remains discovery-only and exposes no public held-button or drag API",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");
  for(const method of["pointer.drag","pointer.down","pointer.up","pointer.button"]){assert.equal(router.includes(`\"${method}\"`),false,method);}
  const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(phase10,/one atomic primary-display fallback operation/i);
  assert.match(phase10,/release cleanup on failure/i);
  assert.match(phase10,/test-owned fixture with an independently observable drag consequence/i);
});

test("Phase 10C physical harness is privacy-bounded and does not persist coordinates",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");
  assert.match(physical,/"swiftc","-parse-as-library"/);
  assert.match(physical,/phase10c-drag-fixture-consequence/);
  assert.match(physical,/phase10c-drag-pointer-restored/);
  assert.match(physical,/phase10c-drag-release-clean/);
  assert.match(physical,/coordinatesLogged=false/);
  assert.match(physical,/nativeDisplayIdsLogged=false/);
  assert.doesNotMatch(physical,/sourceX|sourceY|destinationX|destinationY|originalX|originalY/);
});
