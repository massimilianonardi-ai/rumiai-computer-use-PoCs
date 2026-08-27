"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const physical=fs.readFileSync(path.resolve(__dirname,"../physical-tests/macos-native-text-mutation.js"),"utf8");
const observer=fs.readFileSync(path.resolve(__dirname,"../physical-tests/helpers/macos-read-ax-text-value.swift"),"utf8");

test("Phase 8C physical postcondition uses a test-owned fresh AXValue observer instead of cached ui.describe.value",()=>{
  assert.match(physical,/macos-read-ax-text-value\.swift/);
  assert.match(physical,/function exactValue\(observer,pid,target\)/);
  assert.doesNotMatch(physical,/async function exactValue\(client,target\)/);
  assert.doesNotMatch(physical,/client\.describe\(\{application:APP,target:rebound\}\)/);
  assert.match(observer,/kAXValueAttribute/);
  assert.match(observer,/AXUIElementCopyAttributeValue/);
  assert.match(observer,/AXTextArea/);
  assert.doesNotMatch(observer,/Safari|WebKit|HTML|ARIA|clipboard|keyboard/i);
});
