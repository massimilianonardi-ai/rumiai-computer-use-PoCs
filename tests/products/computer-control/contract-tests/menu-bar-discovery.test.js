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
  assert.match(physical,/ready\?\.verified===true&&ready\?\.state==="READY"/);
  assert.doesNotMatch(physical,/ready\?\.running===true/);
  assert.match(physical,/phase9c1-menu-topology-json/);
  assert.match(physical,/phase9c1-menu-bar-present/);
  assert.match(physical,/phase9c1-menu-top-level-marker/);
  assert.match(fixture,/RumiAI Actions/);
  assert.match(fixture,/Alpha Action/);
  assert.match(fixture,/Disabled Action/);
  assert.match(fixture,/Nested Action/);
});

test("Phase 9C1 historical s01 FAIL is preserved as a readiness-harness defect",()=>{
  const evidencePath=path.join(__dirname,"../sessions/cc-phase9c1-menu-bar-discovery-s01/session-result.json");
  const evidence=JSON.parse(fs.readFileSync(evidencePath,"utf8"));
  assert.equal(evidence.productShaExpected,"ebce7c87c264932144909a491d04c7f307b4cafe");
  assert.equal(evidence.productShaObserved,evidence.productShaExpected);
  assert.equal(evidence.testSourceSha,"05ff98d93d741d820f6a79867530d1579600bf9e");
  assert.equal(evidence.pocShaTested,"e7e187c5511b9072f49c989e6ce6202a148802a7");
  assert.equal(evidence.summary.overall,"FAIL");
  assert.equal(evidence.summary.fail,1);
});
