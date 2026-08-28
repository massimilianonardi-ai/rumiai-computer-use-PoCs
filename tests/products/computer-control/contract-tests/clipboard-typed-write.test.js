"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const structure=require(path.join(productRoot,"backends/macos/backend-structure"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});
  if(name==="writeClipboardFormat")return async params=>({state:"WRITTEN",verified:true,revision:"9",itemIndex:0,...params,byteCount:3,changed:true,idempotent:false,verification:{method:"native-typed-readback-exact",evidence:{revision:"9",itemIndex:0,format:params.format,byteCount:3}},backend:{name:"macos-ax",strategy:"os-owned-native-clipboard-typed-write",fallback:false}});
  return async()=>({});
}});}

test("Phase 9D2C router accepts only canonical typed-write input",async()=>{
  const route=createRouter(fixtureBackend());
  const valid={format:"text/plain",dataBase64:"YWJj"};
  const value=await route("clipboard.writeFormat",valid);
  assert.equal(value.state,"WRITTEN");
  assert.equal(value.verified,true);
  for(const params of[
    {},
    {format:"application/octet-stream",dataBase64:"YWJj"},
    {format:"text/plain"},
    {format:"text/plain",dataBase64:7},
    {format:"text/plain",dataBase64:"YQ"},
    {format:"text/plain",dataBase64:"YWJj",nativeType:"public.utf8-plain-text"},
  ]) await assert.rejects(route("clipboard.writeFormat",params),error=>String(error.code||"").startsWith("CLIPBOARD_")||error.code==="INVALID_CLIPBOARD_TYPED_WRITE_PARAMS");
});

test("Phase 9D2C native writer mutates only NSPasteboard general and reports delivery, not semantic success",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-clipboard-typed-write.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-clipboard-typed-write.js"),"utf8");
  assert.match(helper,/NSPasteboard\.general/);
  assert.match(helper,/FileHandle\.standardInput\.readDataToEndOfFile/);
  assert.match(helper,/clearContents\(\)/);
  assert.match(helper,/setData\(payload, forType:/);
  assert.match(helper,/afterRevision\s*!=\s*beforeRevision/);
  assert.match(helper,/items\.count\s*==\s*1/);
  assert.match(helper,/types\.contains\(nativeType\)/);
  assert.match(helper,/"state": "DELIVERED"/);
  assert.doesNotMatch(helper,/CGEvent|NSEvent|keyCode|osascript|AppleScript|pbcopy|pbpaste/);
  assert.match(wrapper,/MAX_PAYLOAD_BYTES=16\*1024\*1024/);
  assert.match(wrapper,/MAX_TRANSPORT_BYTES=32\*1024\*1024/);
  assert.match(wrapper,/input:payload/);
  assert.doesNotMatch(wrapper,/agent-ctrl|keyboard|click|mouse/);
});

test("Phase 9D2C backend remains exact-readback verified after physical promotion",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");
  assert.match(source,/clipboard\.readFormat.*PHYSICALLY_VALIDATED/);
  assert.match(source,/clipboard\.writeFormat.*PHYSICALLY_VALIDATED/);
  assert.match(source,/clipboardTypedWrite\.write/);
  assert.match(source,/clipboardTypedRead\.read/);
  assert.match(source,/observed\.dataBase64!==dataBase64/);
  assert.match(source,/CLIPBOARD_TYPED_WRITE_POSTCONDITION_UNVERIFIED/);
  assert.match(source,/native-typed-readback-exact/);
  assert.match(source,/state:"WRITTEN"/);
  assert.match(source,/verified:true/);
  assert.match(source,/changed:true/);
  assert.match(source,/idempotent:false/);
  assert.match(source,/fallback:false/);
});

test("Phase 9D2C base64 boundary is canonical and byte preserving",()=>{
  const bytes=Buffer.from([0,1,2,253,254]);
  const canonical=bytes.toString("base64");
  assert.equal(structure.canonicalBase64(canonical).equals(bytes),true);
  assert.throws(()=>structure.canonicalBase64(canonical.replace(/=$/,"")),error=>error.code==="CLIPBOARD_PAYLOAD_INVALID_BASE64");
  assert.throws(()=>structure.canonicalBase64(null),error=>error.code==="CLIPBOARD_PAYLOAD_REQUIRED");
});

test("Phase 9D2C schemas expose verification metadata but never echo payload",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-write-format.params.schema.json"),"utf8"));
  assert.deepEqual(params.required,["format","dataBase64"]);
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties.format.enum,["text/plain","text/html","text/rtf","image/png"]);
  const result=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-write-format-result.schema.json"),"utf8"));
  assert.equal(result.properties.state.const,"WRITTEN");
  assert.equal(result.properties.verified.const,true);
  assert.equal(result.properties.byteCount.maximum,16777216);
  assert.equal(result.properties.verification.properties.method.const,"native-typed-readback-exact");
  assert.equal(result.additionalProperties,false);
  const resultText=JSON.stringify(result);
  for(const forbidden of["dataBase64","payload","nativeType","rawType","typeIdentifier","UTI","nativeRef","handle"])assert.equal(resultText.includes(forbidden),false,forbidden);
});

test("Phase 9D2C SDK/adapter are thin projections and legacy text clipboard remains unchanged",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[sdk,types,adapter])assert.match(source,/writeClipboardFormat/);
  const legacyRouter=fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  const legacySchema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard.params.schema.json"),"utf8"));
  for(const method of["read","write","copy","paste"])assert.match(legacyRouter,new RegExp(`case \\"clipboard\\.${method}\\"`));
  assert.deepEqual(legacySchema.required,["text"]);
  assert.equal(legacySchema.properties.text.type,"string");
  assert.equal(legacySchema.additionalProperties,false);
});

test("Phase 9D2C docs record authoritative physical promotion and closed Phase 9D",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-clipboard.md"),"utf8");
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d2c-clipboard-typed-write-physical.md"),"utf8");
  assert.match(docs,/Phase 9D2C validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/Delivery is not success/);
  assert.match(docs,/native-typed-readback-exact/);
  assert.match(docs,/stdin/i);
  assert.match(docs,/does not echo `dataBase64`/);
  assert.match(docs,/358e22bca3b18bb835e91ae05fece1b3a757b722/);
  assert.match(evidence,/39 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  for(const format of["text/plain","text/html","text/rtf","image/png"])assert.match(evidence,new RegExp(format.replace("/","\\/")));
  assert.match(evidence,/c9806844aecb3bde47f72ee37e2e731c8d6e6c99/);
  assert.match(roadmap,/Phase 9D2B typed clipboard read\s+PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D2C typed clipboard write\s+PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D — displays and richer clipboard — COMPLETE/);
});
