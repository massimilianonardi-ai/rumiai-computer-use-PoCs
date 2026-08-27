"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const physical=fs.readFileSync(path.join(__dirname,"../physical-tests/macos-file-picker-semantic-actions-v2.js"),"utf8");
const observer=fs.readFileSync(path.join(__dirname,"../physical-tests/helpers/macos-file-picker-result-diagnostic.swift"),"utf8");

test("Phase 9B3C final physical observer validates AppKit completion independently",()=>{
  assert.match(physical,/macos-file-picker-result-diagnostic\.swift/);
  assert.match(physical,/Picker Result: accepted Alpha\.txt/);
  assert.match(physical,/Picker Result: cancelled/);
  assert.match(physical,/acceptFilePicker/);
  assert.match(physical,/cancelFilePicker/);
  assert.match(physical,/observeFilePicker/);
  assert.match(physical,/physical-phase9b3c-file-picker-semantic-actions-v2=PASS/);
  assert.doesNotMatch(physical,/findResult\(/);
  assert.match(observer,/AXUIElementCreateApplication/);
  assert.match(observer,/kAXValueAttribute/);
  assert.doesNotMatch(observer,/AXUIElementPerformAction|CGEvent|NSEvent|keyCode|mouse|clipboard|keyboard/);
});
