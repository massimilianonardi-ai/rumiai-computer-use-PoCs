"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const test=require("node:test");
const fs=require("node:fs");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const modulePath=path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-text-selection.js");

test("native text rebind only bridges text-field and text-area vocabularies",()=>{
  const nativeSelection=require(modulePath);
  assert.equal(nativeSelection.alternateNativeTextRole("text-field"),"text-area");
  assert.equal(nativeSelection.alternateNativeTextRole("text-area"),"text-field");
  assert.equal(nativeSelection.alternateNativeTextRole("search-box"),null);
  assert.equal(nativeSelection.alternateNativeTextRole("button"),null);
});

test("native text rebind retries only an exact stale-target failure",()=>{
  const source=fs.readFileSync(modulePath,"utf8");
  assert.match(source,/data\?\.error==="TEXT_TARGET_STALE"&&alternate/);
  assert.match(source,/run\(helper\.path,\[String\(pid\),alternate,requestedName\]\)/);
  assert.doesNotMatch(source,/TEXT_SELECTION_UNAVAILABLE.*alternate|ACCESSIBILITY_PERMISSION_REQUIRED.*alternate/);
});
