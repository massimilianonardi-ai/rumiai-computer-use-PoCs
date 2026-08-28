"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const helper=path.join(__dirname,"../physical-tests/helpers/macos-phase10c-drag-public-fixture.swift");

test("Phase 10C public fixture has one canonical near helper and compiles without CGPoint/NSPoint redeclaration",()=>{
  const source=fs.readFileSync(helper,"utf8");
  const matches=source.match(/private func near\(/g)||[];
  assert.equal(matches.length,1);
  assert.match(source,/private func near\(_ a:CGPoint,_ b:CGPoint/);
  assert.doesNotMatch(source,/private func near\(_ a:NSPoint/);
});
