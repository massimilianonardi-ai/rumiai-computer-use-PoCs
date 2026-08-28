"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const helperPath=path.join(__dirname,"../physical-tests/helpers/macos-phase10e-keyboard-delivery-discovery.swift");
const physicalPath=path.join(__dirname,"../physical-tests/macos-phase10e-keyboard-delivery-discovery.js");

test("Phase 10E remains rooted in authoritative public Phase 10D validation and keyboard discovery evidence",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend-low-level.js"),"utf8");const evidence10d=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10d-pointer-wheel-public-physical.md"),"utf8");const evidence10e=fs.readFileSync(path.join(productRoot,"docs/evidence/phase10e-keyboard-delivery-discovery-physical.md"),"utf8");const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(backend,/pointer\.wheel.*validationState:"PHYSICALLY_VALIDATED"/);assert.match(backend,/keyboard\.press.*validationState:"IMPLEMENTED"/);assert.match(evidence10d,/b1ed223bb401ab79b5b7e6cc11c8512347afe0be/);assert.match(evidence10e,/1aa6efa523dab83d7dd5e2b14fb1b6deb83dc324/);assert.match(phase10,/Phase 10E keyboard\s+IMPLEMENTED/);
});

test("historical Phase 10E discovery uses symbolic platform constants rather than guessed numeric virtual-key ids",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/import Carbon\.HIToolbox/);for(const symbol of["kVK_ANSI_A","kVK_Return","kVK_Shift"])assert.match(helper,new RegExp(symbol));assert.doesNotMatch(helper,/virtualKey:\s*\d+/);assert.doesNotMatch(helper,/keyCode\s*==\s*\d+/);
});

test("historical Phase 10E discovery owns an AppKit text fixture and observes printable, special-key and modifier consequences",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/ProbeTextView:\s*NSTextView/);assert.match(helper,/override func keyDown/);assert.match(helper,/override func keyUp/);assert.match(helper,/override func flagsChanged/);assert.match(helper,/text\.string == "a"/);assert.match(helper,/text\.string == "\\n"/);assert.match(helper,/text\.string == "A"/);assert.match(helper,/shiftOnCount/);assert.match(helper,/shiftOffCount/);assert.match(helper,/shiftedADownCount/);
});

test("historical Phase 10E discovery posts complete key lifecycles and owns modifier cleanup",()=>{
  const helper=fs.readFileSync(helperPath,"utf8");assert.match(helper,/aDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/aUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/returnDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/returnUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftDown\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftUp\.post\(tap:\s*\.cghidEventTap\)/);assert.match(helper,/shiftMayBeDown/);assert.match(helper,/emergencyShiftReleasePosted/);assert.match(helper,/previousApp\.activate/);assert.doesNotMatch(helper,/osascript|AppleScript|System Events/);
});

test("Phase 10E public advancement exposes only keyboard.press and keeps semantic operations preferred",()=>{
  const router=["router.js","router-core.js","router-low-level.js"].map(name=>fs.readFileSync(path.join(productRoot,"runtime/src",name),"utf8")).join("\n");assert.equal(router.includes('"keyboard.press"'),true);for(const method of["keyboard.key","keyboard.type","keyboard.text","keyboard.down","keyboard.up","input.key"]){assert.equal(router.includes(`\"${method}\"`),false,method);}const phase10=fs.readFileSync(path.join(productRoot,"docs/phase10-low-level-fallbacks.md"),"utf8");assert.match(phase10,/Existing semantic text mutation, invoke and other structured APIs remain preferred/i);assert.match(phase10,/success state is `KEY_POSTED`/i);assert.match(phase10,/semanticConsequenceVerified.*always false/i);
});

test("Phase 10E historical harness logs no numeric keycodes or user text",()=>{
  const physical=fs.readFileSync(physicalPath,"utf8");assert.match(physical,/"swiftc","-parse-as-library"/);assert.match(physical,/"-framework","Carbon"/);assert.match(physical,/numericKeycodesLogged=false userTextLogged=false/);assert.doesNotMatch(physical,/kVK_|virtualKey|text\.string|keyCode/);
});
