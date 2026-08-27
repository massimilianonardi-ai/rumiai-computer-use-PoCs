"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");

test("Phase 9C2+9C3 combined discovery is read-only and OS-owned",()=>{
  const helper=fs.readFileSync(path.join(__dirname,"../physical-tests/helpers/macos-system-chrome-topology.swift"),"utf8");
  assert.match(helper,/com\.apple\.dock/);
  assert.match(helper,/com\.apple\.systemuiserver/);
  assert.match(helper,/com\.apple\.controlcenter/);
  assert.match(helper,/kAXExtrasMenuBarAttribute/);
  assert.match(helper,/AXUIElementCopyActionNames/);
  assert.match(helper,/AXUIElementCopyAttributeNames/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent|keyCode|osascript|AppleScript/);
});

test("Phase 9C2+9C3 discovery starts only after Phase 9C1A physical promotion",()=>{
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  const api=fs.readFileSync(path.join(productRoot,"docs/api-menu-bar.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c1a-menu-bar-observation-physical.md"),"utf8");
  assert.match(backend,/menuBar\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(api,/Phase 9C1A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(evidence,/decc4ccd989c694e624e3c3db69884b6903b0cee/);
  assert.match(evidence,/31 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 9C2+9C3 discovery remains historical topology evidence while public phases advance independently",()=>{
  const router=fs.readFileSync(path.join(productRoot,"runtime/src/router.js"),"utf8");
  const dockApi=fs.readFileSync(path.join(productRoot,"docs/api-dock.md"),"utf8");
  const discoveryEvidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9c23-system-chrome-discovery.md"),"utf8");
  assert.match(router,/dock\.observe/);
  assert.doesNotMatch(router,/dock\.invoke|menuExtras\.observe|menuExtras\.invoke|systemChrome\./);
  assert.match(dockApi,/Phase 9C2A validation state: `IMPLEMENTED`/);
  assert.match(dockApi,/No generic Dock invocation API is introduced by Phase 9C2A/);
  assert.match(discoveryEvidence,/This checkpoint is discovery evidence only/);
  assert.match(discoveryEvidence,/defines no public API and exposes no durable native identifier/);
});
