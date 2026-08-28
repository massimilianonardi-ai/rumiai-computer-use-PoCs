"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10e-keyboard-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10e-keyboard-delivery-discovery.js");

test("Phase 10E starts only after authoritative public Phase 10D validation",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-pointer-wheel-public-physical.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(backend,/pointer\.wheel.*validationState:"PHYSICALLY_VALIDATED"/);assert.match(evidence,/b1ed223bb401ab79b5b7e6cc11c8512347afe0be/);assert.match(evidence,/validated product: a3fcd4cbaa4f770e59bd974c0239b9af35701e99/);assert.match(phase10,/Phase 10E keyboard\s+PENDING/);
});

test("Phase 10E discovery uses symbolic platform constants rather than guessed numeric virtual-key ids",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/import Carbon\.HIToolbox/);for(const symbol of["kVK_ANSI_A","kVK_Return","kVK_Shift"])assert.match(helper,new RegExp(symbol));assert.doesNotMatch(helper,/virtualKey:\s*\d+/);assert.doesNotMatch(helper,/keyCode\s*==\s*\d+/);
});

test("Phase 10E discovery owns an AppKit text fixture and observes printable, special-key and modifier consequences",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/ProbeTextView:\s*NSTextView/);assert.match(helper,/override func keyDown/);assert.match(helper,/override func keyUp/);assert.match(helper,/override func flagsChanged/);assert.match(helper,/text\.string == "a"/);assert.match(helper,/text\.string == "\\n"/);assert.match(helper,/text\.string == "A"/);assert.match(helper,/shiftOnCount/);assert.match(helper,/shiftOffCount/);assert.match(helper,/shiftedADownCount/);
});

test("Phase 10E discovery posts complete key lifecycles and owns modifier cleanup",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/aDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/aUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/returnDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/returnUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftMayBeDown/);assert.match(helper,/emergencyShiftReleasePosted/);assert.match(helper,/previousApp\.activate/);assert.doesNotMatch(helper,/osascript|AppleScript|System Events/);
});

test("Phase 10E remains discovery-only with no public keyboard surface",()=>{
  const router=["router.js","router-core.js","router-low-level.js"].map(name=>fs.readFileSync(path.join(productRoot,"runtime/src",name),"utf8")).join("\n");for(const method of["keyboard.key","keyboard.type","keyboard.text","keyboard.down","keyboard.up","input.key"]){assert.equal(router.includes(`\"${method}\"`),false,method);}const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(phase10,/Existing semantic text mutation, invoke and other structured APIs remain preferred/i);assert.match(phase10,/no public API frozen by the discovery itself/i);
});

test("Phase 10E harness logs no numeric keycodes or user text",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");assert.match(physical,/"swiftc","-parse-as-library"/);assert.match(physical,/"-framework","Carbon"/);assert.match(physical,/numericKeycodesLogged=false userTextLogged=false/);assert.doesNotMatch(physical,/kVK_|virtualKey|text\.string|keyCode/);
});
