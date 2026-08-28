"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const macBackend=require(path.join(productRoot,"backends/macos/backend"));

function backend(){return new Proxy({},{get(_target,name){if(name==="info")return async()=>({name:"fixture",version:"0",platform:"test",capabilities:[]});if(name==="observeClipboard")return async()=>({state:"OBSERVED",revision:"7",items:[]});return async()=>({});}});}

test("Phase 9D2A router exposes global parameterless clipboard metadata observation",async()=>{
  const route=createRouter(backend());
  await assert.rejects(route("clipboard.observe",{application:"Finder"}),e=>e.code==="INVALID_CLIPBOARD_OBSERVE_PARAMS");
  await assert.rejects(route("clipboard.observe",{format:"text/plain"}),e=>e.code==="INVALID_CLIPBOARD_OBSERVE_PARAMS");
  const value=await route("clipboard.observe",{});
  assert.equal(value.state,"OBSERVED");
  assert.equal(value.revision,"7");
  assert.deepEqual(value.items,[]);
});

test("Phase 9D2A native helper remains metadata-only and race-safe after promotion",()=>{
  const helper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/tools/macos-clipboard-metadata-observation.swift"),"utf8");
  const wrapper=fs.readFileSync(path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/macos-clipboard-metadata-observation.js"),"utf8");
  assert.match(helper,/NSPasteboard\.general/);
  assert.match(helper,/changeCount/);
  assert.match(helper,/pasteboardItems/);
  assert.match(helper,/item\.types/);
  assert.match(helper,/beforeRevision\s*!=\s*afterRevision/);
  assert.match(helper,/CLIPBOARD_CHANGED_DURING_OBSERVATION/);
  assert.doesNotMatch(helper,/string\s*\(\s*forType|data\s*\(\s*forType|propertyList\s*\(\s*forType|readObjects|clearContents|declareTypes|setString|setData|writeObjects/);
  assert.doesNotMatch(wrapper,/agent-ctrl|pbcopy|pbpaste|keyboard|click|mouse/);
});

test("Phase 9D2A canonicalization exposes only closed semantic format metadata",()=>{
  const value=macBackend.canonicalClipboardMetadata({revision:19,items:[{index:0,formats:["image/png","text/plain"],unsupportedFormatCount:2,rawTypes:["private.example"]},{index:1,formats:[],unsupportedFormatCount:1}]});
  assert.deepEqual(value,{revision:"19",items:[{index:0,formats:["text/plain","image/png"],unsupportedFormatCount:2},{index:1,formats:[],unsupportedFormatCount:1}]});
  assert.equal(JSON.stringify(value).includes("private.example"),false);
  assert.throws(()=>macBackend.canonicalClipboardMetadata({revision:"1",items:[{index:2,formats:[],unsupportedFormatCount:0}]}),e=>e.code==="CLIPBOARD_METADATA_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardMetadata({revision:"1",items:[{index:0,formats:["application/x-private"],unsupportedFormatCount:0}]}),e=>e.code==="CLIPBOARD_METADATA_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardMetadata({revision:"1",items:[{index:0,formats:["text/plain","text/plain"],unsupportedFormatCount:0}]}),e=>e.code==="CLIPBOARD_METADATA_INVALID_NATIVE_STATE");
  assert.throws(()=>macBackend.canonicalClipboardMetadata({revision:"",items:[]}),e=>e.code==="CLIPBOARD_METADATA_INVALID_NATIVE_STATE");
});

test("Phase 9D2A remains physically validated after richer clipboard completion",()=>{
  const phase9=fs.readFileSync(path.join(productRoot,"backends/macos/backend.js"),"utf8");
  const structure=fs.readFileSync(path.join(productRoot,"backends/macos/backend-structure.js"),"utf8");
  assert.match(phase9,/display\.list.*PHYSICALLY_VALIDATED/);
  assert.match(phase9,/clipboard\.observe.*PHYSICALLY_VALIDATED/);
  assert.match(structure,/clipboard\.readFormat.*PHYSICALLY_VALIDATED/);
  assert.match(structure,/clipboard\.writeFormat.*PHYSICALLY_VALIDATED/);
  assert.match(phase9,/os-owned-native-clipboard-metadata-observation/);
  assert.match(phase9,/async observeClipboard/);
});

test("Phase 9D2A public schema contains canonical metadata and no native type identity or payload fields",()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-observe-result.schema.json"),"utf8"));
  const text=JSON.stringify(schema);
  for(const forbidden of["typeIdentifier","nativeType","rawType","rawTypes","payload","pngBytes","base64","nativeRef","handle"])assert.equal(text.includes(forbidden),false,forbidden);
  const item=schema.properties.items.items;
  assert.deepEqual(item.required,["index","formats","unsupportedFormatCount"]);
  assert.equal(item.additionalProperties,false);
  assert.deepEqual(Object.keys(item.properties).sort(),["formats","index","unsupportedFormatCount"]);
  assert.deepEqual(item.properties.formats.items.enum,["text/plain","text/html","text/rtf","image/png"]);
  const params=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard-observe.params.schema.json"),"utf8"));
  assert.equal(params.additionalProperties,false);
  assert.deepEqual(params.properties,{});
});

test("Phase 9D2A preserves legacy text clipboard semantics and thin SDK/adapter projection",()=>{
  const legacyRouter=fs.readFileSync(path.join(productRoot,"runtime/src/router-core.js"),"utf8");
  const legacySchema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/clipboard.params.schema.json"),"utf8"));
  assert.match(legacyRouter,/case "clipboard\.read"/);
  assert.match(legacyRouter,/case "clipboard\.write"/);
  assert.match(legacyRouter,/case "clipboard\.copy"/);
  assert.match(legacyRouter,/case "clipboard\.paste"/);
  assert.deepEqual(legacySchema.required,["text"]);
  assert.equal(legacySchema.properties.text.type,"string");
  assert.equal(legacySchema.additionalProperties,false);
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  const adapter=fs.readFileSync(path.join(productRoot,"adapters/rumiai/compat.js"),"utf8");
  for(const source of[sdk,types,adapter])assert.match(source,/observeClipboard/);
});

test("Phase 9D2A documentation records authoritative s03 physical promotion",()=>{
  const docs=fs.readFileSync(path.join(productRoot,"docs/api-clipboard.md"),"utf8");
  const roadmap=fs.readFileSync(path.join(productRoot,"docs/native-controls-roadmap.md"),"utf8");
  const evidence=fs.readFileSync(path.join(productRoot,"docs/evidence/phase9d2a-clipboard-metadata-observation-physical.md"),"utf8");
  assert.match(docs,/Phase 9D2A validation state: `PHYSICALLY_VALIDATED`/);
  assert.match(roadmap,/Phase 9D2A clipboard metadata observation\s+PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D2B typed clipboard read\s+PHYSICALLY_VALIDATED/);
  assert.match(roadmap,/Phase 9D2C typed clipboard write\s+PHYSICALLY_VALIDATED/);
  for(const text of[docs,evidence]){
    assert.match(text,/521f41c2fcc499574b61b658440671faefe61708/);
    assert.match(text,/af5fcf98cfc770302cd1e34c011d46fdeca5adc3/);
    assert.match(text,/58b72853eb65b51e6fda28de52fec152a5a834c0/);
    assert.match(text,/37 PASS \/ 0 FAIL \/ 0 BLOCKED/);
  }
  assert.match(evidence,/fadb856d43418f383e273bd50794ba37fb568ba7/);
});
