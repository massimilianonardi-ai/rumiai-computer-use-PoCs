"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10c-drag-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10c-drag-delivery-discovery.js");

test("Phase 10C remains rooted in authoritative public Phase 10B validation and drag discovery evidence",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");const evidence10b=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10b-pointer-public-physical.md"),"utf8");const evidence10c=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10c-drag-delivery-discovery-physical.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");
  assert.match(backend,/pointer\.move.*PHYSICALLY_VALIDATED/);assert.match(backend,/pointer\.click.*PHYSICALLY_VALIDATED/);assert.match(backend,/pointer\.drag.*IMPLEMENTED/);assert.match(evidence10b,/a7b878ff25e56ee7c16705dfdec1468f6a47b0a1/);assert.match(evidence10b,/43 PASS \/ 0 FAIL \/ 0 BLOCKED/);assert.match(evidence10c,/47ee8e31a08597cffc0c773dfaf72a093501e5c4/);assert.match(phase10,/Phase 10C drag\/drop\s+IMPLEMENTED/);
});

test("Phase 10C discovery owns a complete left-button drag lifecycle inside one process",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/\.leftMouseDown/);assert.match(helper,/\.leftMouseDragged/);assert.match(helper,/\.leftMouseUp/);assert.match(helper,/buttonMayBeDown/);assert.match(helper,/down\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/dragged\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/up\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/emergencyUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/if buttonMayBeDown/);assert.match(helper,/CGWarpMouseCursorPosition\(original\)/);assert.match(helper,/previousApp\.activate/);assert.doesNotMatch(helper,/osascript|AppleScript|cliclick|pointer\.down|pointer\.up/);
});

test("Phase 10C discovery requires independent AppKit drag consequence, not event construction alone",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/final class MarkerView/);assert.match(helper,/override func hitTest\(_ point: NSPoint\) -> NSView\? \{ nil \}/);assert.match(helper,/override func mouseDown/);assert.match(helper,/override func mouseDragged/);assert.match(helper,/override func mouseUp/);assert.match(helper,/draggedCount/);assert.match(helper,/setMarkerCenter\(event\.locationInWindow\)/);assert.match(helper,/DRAG_FIXTURE_CONSEQUENCE_NOT_OBSERVED/);assert.match(helper,/fixtureConsequenceObserved/);assert.match(helper,/semanticConsequenceClaimed/);
});

test("Phase 10C public advancement adds only atomic pointer.drag and still no held-button API",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router-low-level.js"),"utf8");assert.match(router,/pointer\.drag/);for(const method of["pointer.down","pointer.up","pointer.button"]){assert.equal(router.includes(`\"${method}\"`),false,method);}const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(phase10,/one atomic primary-display fallback operation/i);assert.match(phase10,/helper constructs the complete normal lifecycle before button-down/i);assert.match(phase10,/public `pointer\.down`\/`pointer\.up` remain absent/i);
});

test("Phase 10C historical discovery harness remains privacy-bounded and immutable",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");assert.match(physical,/"swiftc","-parse-as-library"/);assert.match(physical,/phase10c-drag-fixture-consequence/);assert.match(physical,/phase10c-drag-pointer-restored/);assert.match(physical,/phase10c-drag-release-clean/);assert.match(physical,/coordinatesLogged=false/);assert.match(physical,/nativeDisplayIdsLogged=false/);assert.doesNotMatch(physical,/sourceX|sourceY|destinationX|destinationY|originalX|originalY/);
});
