"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const here=__dirname;

test("Phase 9B3B directory-action discovery is read-only and action-introspection only",()=>{
  const helper=fs.readFileSync(path.join(here,"../physical-tests/helpers/macos-file-picker-directory-actions.swift"),"utf8");
  const physical=fs.readFileSync(path.join(here,"../physical-tests/macos-file-picker-directory-actions-discovery.js"),"utf8");
  assert.match(helper,/AXUIElementCopyActionNames/);
  assert.match(helper,/AXUIElementCopyActionDescription/);
  assert.match(helper,/FolderA/);
  assert.doesNotMatch(helper,/AXUIElementPerformAction|AXUIElementSetAttributeValue|CGEvent|NSEvent/);
  assert.match(physical,/phase9b3b-directory-actions-json/);
  assert.match(physical,/physical-phase9b3b-directory-actions-discovery=PASS/);
  assert.doesNotMatch(physical,/openFilePickerDirectory|selectFilePickerItem/);
});

test("Phase 9B3B historical action discovery remains preserved after physical promotion",()=>{
  const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.resolve(here,"../../../../../../lib/computer-control");
  const backend=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(backend,/filePicker\.selectItem.*PHYSICALLY_VALIDATED/);
  assert.match(backend,/filePicker\.expandDirectory.*PHYSICALLY_VALIDATED/);
  assert.doesNotMatch(backend,/filePicker\.openDirectory/);
});