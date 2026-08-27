"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),test=require("node:test");
const here=__dirname;

test("Phase 9B3C accept-result diagnostic observes fixture completion without direct UI mutation",()=>{
  const helper=fs.readFileSync(path.join(here,"../physical-tests/helpers/macos-file-picker-result-diagnostic.swift"),"utf8");
  const physical=fs.readFileSync(path.join(here,"../physical-tests/macos-file-picker-accept-result-diagnostic.js"),"utf8");
  assert.match(helper,/Picker Result:/);
  assert.match(helper,/kAXStaticTextRole/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent/);
  assert.match(physical,/acceptFilePicker/);
  assert.match(physical,/phase9b3c-accept-result-diagnostic/);
  assert.match(physical,/physical-phase9b3c-file-picker-accept-result-diagnostic=PASS/);
  assert.doesNotMatch(physical,/cancelFilePicker/);
});
