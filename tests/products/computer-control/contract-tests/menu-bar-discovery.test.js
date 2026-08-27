"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

test("Phase 9C1 menu bar discovery is Provider-scoped and read-only",()=>{
  const helper=fs.readFileSync(path.join(__dirname,"../physical-tests/helpers/macos-menu-bar-topology.swift"),"utf8");
  const physical=fs.readFileSync(path.join(__dirname,"../physical-tests/macos-menu-bar-discovery.js"),"utf8");
  const fixture=fs.readFileSync(path.join(__dirname,"../fixtures/macos-appkit-menu-bar-discovery/main.swift"),"utf8");
  assert.match(helper,/kAXMenuBarAttribute/);
  assert.match(helper,/AXUIElementCopyActionNames/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent|keyCode/);
  assert.match(physical,/ensureApplicationReady/);
  assert.match(physical,/phase9c1-menu-topology-json/);
  assert.match(physical,/phase9c1-menu-bar-present/);
  assert.match(physical,/phase9c1-menu-top-level-marker/);
  assert.match(fixture,/RumiAI Actions/);
  assert.match(fixture,/Alpha Action/);
  assert.match(fixture,/Disabled Action/);
  assert.match(fixture,/Nested Action/);
});
