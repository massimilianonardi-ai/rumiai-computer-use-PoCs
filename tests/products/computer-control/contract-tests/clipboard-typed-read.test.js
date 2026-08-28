"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const macBackend=require(path.join(productRoot,"backends/macos/backend"));

function fixtureBackend(){return new Proxy({},{get(_target,name){
  if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});
  if(name==="readClipboardFormat")return async params=>({state:"READ",...params,byteCount:3,dataBase64:"YWJj"});
  return async()=>({});
}});}

test("Phase 9D2B router requires revision-scoped canonical typed-read addressing",async()=>{
  const route=createRouter(fixtureBackend());
  for(const params of[
    {},
    {revision:"",itemIndex:0,format:"text/plain"},
    {revision:"1",itemIndex:-1,format:"text/plain"},
    {revision:"1",itemIndex:0.5,format:"text/plain"},
    {revision:"1",itemIndex:0,format:"application/octet-stream"},
    {revision:"1",itemIndex:0,format:"text/plain",nativeType:"public.utf8-plain-text"},
  ]) await assert.rejects(route("clipboard.readFormat",params),error=>String(error.code||"").startsWith("CLIPBOARD_")||error.code==="INVALID_CLIPBOARD_TYPED_READ_PARAMS");
  const value=await route("clipboard.readFormat",{revision:"1",itemIndex:0,format:"text/plain"});
  assert.deepEqual(value,{state:"READ",revision:"1",itemIndex:0,format:"text/plain",byteCount:3,dataBase64:"YWJj"});
});

test("Phase 9D2B native helper is read-only, revision-guarded and format-advertisement-guarded",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-clipboard-typed-read.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-clipboard-typed-read.js"),"utf8");
  assert.match(helper,/NSPasteboard\.general/);
  assert.match(helper,/beforeRevision\s*==\s*requestedRevision/);
  assert.match(helper,/afterRevision\s*==\s*requestedRevision/);
  assert.match(helper,/CLIPBOARD_REVISION_STALE/);
  assert.match(helper,/CLIPBOARD_CHANGED_DURING_READ/);
  assert.match(helper,/CLIPBOARD_ITEM_NOT_FOUND/);
  assert.match(helper,/CLIPBOARD_FORMAT_NOT_AVAILABLE/);
  assert.match(helper,/advertised\.contains/);
  assert.match(helper,/item\.data\(forType:/);
  assert.match(helper,/payload\.count\s*<=\s*maxBytes/);
  assert.match(helper,/base64EncodedString/);
  assert.doesNotMatch(helper,/clearContents|declareTypes|setString|setData|writeObjects|CGEvent|NSEvent|keyCode|osascript|AppleScript/);
  assert.doesNotMatch(wrapper,/agent-ctrl|pbcopy|pbpaste|keyboard|click|mouse/);
  assert.match(wrapper,/MAX_PAYLOAD_BYTES=16\*1024\*1024/);
  assert.match(wrapper,/maxBuffer:32\*1024\*1024/);
});

test("Phase 9D2B backend rejects malformed native payload state and preserves exact bytes",()=>{
  const requested={revision:"42",itemIndex:0,format:"image/png"};
  const bytes=Buffer.from([0,1,2,253,254,255]);
  const value=macBackend.canonicalClipboardRead({revision:"42",itemIndex:0,format:"image/png",byteCount:bytes.length,dataBase64:bytes.toString("base64")},requested);
  assert.equal(Buffer.from(value.dataBase64,"base64").equals(bytes),true);
  assert.equal(value.byteCount,bytes.length);
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,revision:"43"},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,itemIndex:1},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,format:"text/plain"},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,byteCount:value.byteCount+1},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,dataBase64:value.dataBase64.replace(/=$/,"")},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardRead({...value,byteCount:16777217},requested),e=>e.code==="CLIPBOARD_TYPED_READ_INVALID_NATIVE_STATE");
});

test("Phase 9D2B capability follows physically validated metadata observation without typed write",()=>{
  const source=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  assert.match(source,/clipboard\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(source,/clipboard\.readFormat.*IMPLEMENTED/);
  assert.match(source,/os-owned-native-clipboard-typed-read/);
  assert.match(source,/async readClipboardFormat/);
  assert.doesNotMatch(source,/clipboard\.writeFormat/);
});

test("Phase 9D2B schemas expose canonical lossless transport only",()=>{
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-read-format.params.schema.json"),"utf8"));
  assert.deepEqual(params.required,["revision","itemIndex","format"]);
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties.format.enum,["text/plain","text/html","text/rtf","image/png"]);
  const result=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-read-format-result.schema.json"),"utf8"));
  assert.equal(result.properties.state.const,"READ");
  assert.equal(result.properties.byteCount.maximum,16777216);
  assert.equal(result.properties.dataBase64.contentEncoding,"base64");
  assert.equal(result.additionalProperties,false);
  const text=JSON.stringify(result);
  for(const forbidden of["nativeType","rawType","typeIdentifier","uti","UTI","handle","nativeRef"])assert.equal(text.includes(forbidden),false,forbidden);
});

test("Phase 9D2B SDK and adapter are thin projections and legacy clipboard remains unchanged",()=>{
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[sdk,types,adapter])assert.match(source,/readClipboardFormat/);
  const legacyRouter=fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  const legacySchema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard.params.schema.json"),"utf8"));
  for(const method of["read","write","copy","paste"])assert.match(legacyRouter,new RegExp(`case \\"clipboard\\.${method}\\"`));
  assert.deepEqual(legacySchema.required,["text"]);
  assert.equal(legacySchema.properties.text.type,"string");
  assert.equal(legacySchema.additionalProperties,false);
});

test("Phase 9D2B docs fix stale/content/size boundaries without premature physical promotion",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-clipboard.md"),"utf8");
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  assert.match(docs,/Phase 9D2B validation state: `IMPLEMENTED`/);
  assert.doesNotMatch(docs,/Phase 9D2B validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(docs,/CLIPBOARD_REVISION_STALE/);
  assert.match(docs,/CLIPBOARD_CHANGED_DURING_READ/);
  assert.match(docs,/16 MiB/);
  assert.match(docs,/lossless/i);
  assert.match(docs,/intentionally reads clipboard content/i);
  assert.match(roadmap,/Phase 9D2A clipboard metadata observation\s+PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D2B typed clipboard read\s+IMPLEMENTED/);
  assert.match(roadmap,/Phase 9D2C typed clipboard write\s+PENDING/);
});
