"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="performFilePickerAction")return async params=>({method:params.action==="cancel"?"filePicker.cancel":"filePicker.accept",...params});return async()=>({});}});}

test("Phase 9B3C router exposes only explicit accept/cancel semantic intents",async()=>{
  const route=createRouter(backend());
  for(const method of["filePicker.accept","filePicker.cancel"]){
    await assert.rejects(route(method,{}),e=>e.code==="APP_REQUIRED");
    await assert.rejects(route(method,{application:"Fixture",timeoutMs:99}),e=>e.code==="INVALID_TIMEOUT");
    await assert.rejects(route(method,{application:"Fixture",name:"Alpha.txt"}),e=>e.code==="INVALID_FILE_PICKER_PARAMS");
    const value=await route(method,{application:"Fixture",timeoutMs:500});
    assert.equal(value.method,method);
    assert.equal(value.application,"Fixture");
    assert.equal(value.action,method.endsWith("cancel")?"cancel":"accept");
  }
});

test("Phase 9B3C resolves physically observed native picker identifiers and presses only that target",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-file-picker-semantic-action.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-file-picker-semantic-action.js"),"utf8");
  assert.match(helper,/expectedIdentifier = action == "accept" \? "OKButton" : "CancelButton"/);
  assert.match(helper,/identifier\(\$0\) == expectedIdentifier/);
  assert.match(helper,/role\(\$0\) == \(kAXButtonRole as String\)/);
  assert.match(helper,/buttons\.count == 1/);
  assert.match(helper,/actionNames\(button\)\.contains\(kAXPressAction as String\)/);
  assert.match(helper,/AXUIElementPerformAction\(button, kAXPressAction as CFString\)/);
  assert.match(helper,/FILE_PICKER_ACCEPT_ACTION_UNAVAILABLE/);
  assert.match(helper,/FILE_PICKER_CANCEL_ACTION_UNAVAILABLE/);
  assert.match(helper,/FILE_PICKER_ACTION_AMBIGUOUS/);
  assert.match(helper,/FILE_PICKER_ACTION_DISABLED/);
  assert.doesNotMatch(helper,/kAXDefaultButtonAttribute|kAXCancelButtonAttribute/);
  assert.doesNotMatch(helper,/CGEvent|keyCode|NSEvent|mouse|clipboard|keyboard|FileManager\.default|contentsOfDirectory/);
  assert.doesNotMatch(wrapper,/agent-ctrl|clipboard|keyboard|click/);
});

test("Phase 9B3C backend requires picker absence while application remains running",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/filePicker\.selectItem.*PHYSICALLY_VALIDATED/);
  assert.match(source,/filePicker\.expandDirectory.*PHYSICALLY_VALIDATED/);
  assert.match(source,/filePicker\.accept.*PHYSICALLY_VALIDATED/);
  assert.match(source,/filePicker\.cancel.*PHYSICALLY_VALIDATED/);
  assert.match(source,/provider-scoped-native-AX-picker-accept-button/);
  assert.match(source,/provider-scoped-native-AX-picker-cancel-button/);
  assert.match(source,/FILE_PICKER_ACTION_APP_EXITED/);
  assert.match(source,/native-file-picker-absent-after-semantic-action/);
  assert.match(source,/after\.pickers\.length===0/);
  assert.match(source,/FILE_PICKER_ACTION_POSTCONDITION_UNVERIFIED/);
});

test("Phase 9B3C public contract contains no picker button label or native identity",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/file-picker-semantic-action.params.schema.json"),"utf8"));
  assert.deepEqual(Object.keys(params.properties),["application","timeoutMs"]);
  assert.equal(params.additionalProperties,false);
  const result=JSON.stringify(JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/file-picker-semantic-action-result.schema.json"),"utf8")));
  for(const forbidden of["pid","AXUIElement","nativeRef","coordinates","buttonLabel","absolutePath","OKButton","CancelButton"])assert.equal(result.includes(forbidden),false,forbidden);
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const text of[sdk,types,adapter]){assert.match(text,/acceptFilePicker/);assert.match(text,/cancelFilePicker/);}
});

test("Phase 9B3C fixture records accepted and cancelled AppKit completion independently",()=>{
  const fixture=fs.readFileSync(path.join(__dirname,"../fixtures/macos-appkit-file-picker-observation/main.swift"),"utf8");
  assert.match(fixture,/response == \.OK/);
  assert.match(fixture,/response == \.cancel/);
  assert.match(fixture,/Picker Result: accepted/);
  assert.match(fixture,/Picker Result: cancelled/);
});

test("Phase 9B3C history remains immutable and canonical s03 evidence is promoted",()=>{
  const s01=JSON.parse(fs.readFileSync(path.join(__dirname,"../sessions/cc-phase9b3c-file-picker-semantic-actions-s01/session-result.json"),"utf8"));
  assert.equal(s01.productShaExpected,"3cedb57d35663f74d0598b6c83645c973cdc6810");
  assert.deepEqual(s01.summary,{pass:26,fail:0,blocked:1,total:27,overall:"BLOCKED"});

  const s02=JSON.parse(fs.readFileSync(path.join(__dirname,"../sessions/cc-phase9b3c-file-picker-semantic-actions-s02/session-result.json"),"utf8"));
  assert.equal(s02.productShaExpected,"2be349b1fdf2a6ea08ee893be423942d926a2c0b");
  assert.deepEqual(s02.summary,{pass:26,fail:1,blocked:0,total:27,overall:"FAIL"});

  const s03=JSON.parse(fs.readFileSync(path.join(__dirname,"../sessions/cc-phase9b3c-file-picker-semantic-actions-s03/session-result.json"),"utf8"));
  assert.equal(s03.productShaExpected,"2be349b1fdf2a6ea08ee893be423942d926a2c0b");
  assert.equal(s03.productShaObserved,s03.productShaExpected);
  assert.equal(s03.testSourceSha,"2f107d05bdce5650929db8ead670f12da2f59f54");
  assert.equal(s03.pocShaTested,"5cc8e8f97cc8fa139248ff3e6c28612df31aa8a9");
  assert.deepEqual(s03.summary,{pass:29,fail:0,blocked:0,total:29,overall:"PASS"});

  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9b3c-file-picker-semantic-actions-physical.md"),"utf8");
  assert.match(evidence,/9a47234951d3de5dff9d4b975892a8b0b07e079d/);
  assert.match(evidence,/29 PASS \/ 0 FAIL \/ 0 BLOCKED/);
});

test("Phase 9B3C documentation is physically promoted",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-file-picker.md"),"utf8");
  assert.match(docs,/Phase 9B3C validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/OKButton/);
  assert.match(docs,/CancelButton/);
  assert.match(docs,/9a47234951d3de5dff9d4b975892a8b0b07e079d/);
});
