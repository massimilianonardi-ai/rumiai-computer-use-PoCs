"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const {createRouter}=require(path.join(productRoot,"runtime/src/router"));
const {createMacOSBackend}=require(path.join(productRoot,"backends/macos/backend"));

function fixture(){return{
  info:async()=>({name:"fixture",version:"0",platform:"macos",capabilities:[]}),
  setValue:async({target,value})=>({state:"VALUE_SET",verified:true,target,requestedValue:value,observedValue:value}),
  increment:async({target})=>({state:"INCREMENTED",verified:true,target,previousValue:5,observedValue:6}),
  decrement:async({target})=>({state:"DECREMENTED",verified:true,target,previousValue:6,observedValue:5}),
};}

test("value mutations route canonical parameters",async()=>{
  const route=createRouter(fixture());
  assert.equal((await route("ui.setValue",{application:"Safari",target:{ref:"@e1"},value:7})).state,"VALUE_SET");
  assert.equal((await route("ui.increment",{application:"Safari",target:{ref:"@e1"}})).state,"INCREMENTED");
  assert.equal((await route("ui.decrement",{application:"Safari",target:{ref:"@e1"}})).state,"DECREMENTED");
  await assert.rejects(route("ui.setValue",{application:"Safari",target:{ref:"@e1"},value:null}),e=>e.code==="CONTROL_VALUE_REQUIRED");
});

test("macOS mapping preserves verified value evidence",async()=>{
  const backend=createMacOSBackend({backendModule:{
    setValue:({element,value})=>({ok:true,verified:true,ref:element.ref,role:"slider",name:"Value",previousValue:5,observedValue:value,changed:true,idempotent:false,verificationMethod:"accessibility-value-postcondition",method:"fill"}),
    increment:({element})=>({ok:true,verified:true,ref:element.ref,role:"slider",name:"Value",previousValue:5,observedValue:6,changed:true,idempotent:false,verificationMethod:"numeric-value-increased",method:"key"}),
    decrement:({element})=>({ok:true,verified:true,ref:element.ref,role:"slider",name:"Value",previousValue:6,observedValue:5,changed:true,idempotent:false,verificationMethod:"numeric-value-decreased",method:"key"}),
  }});
  assert.equal((await backend.setValue({application:"Safari",target:{ref:"@e2"},value:7})).observedValue,7);
  assert.equal((await backend.increment({application:"Safari",target:{ref:"@e2"}})).observedValue,6);
  assert.equal((await backend.decrement({application:"Safari",target:{ref:"@e2"}})).observedValue,5);
});

test("schemas SDK types and capabilities expose value mutations as IMPLEMENTED",async()=>{
  const setSchema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/set-value.params.schema.json"),"utf8"));
  const stepSchema=JSON.parse(fs.readFileSync(path.join(productRoot,"contract/schemas/value-step.params.schema.json"),"utf8"));
  const sdk=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.js"),"utf8");
  const types=fs.readFileSync(path.join(productRoot,"sdk/typescript/src/index.d.ts"),"utf8");
  assert.deepEqual(setSchema.required,["application","target","value"]);
  assert.deepEqual(stepSchema.required,["application","target"]);
  assert.match(sdk,/setValue\(\{application, target, value, settle = true\}\)/);
  assert.match(sdk,/increment\(\{application, target, settle = true\}\)/);
  assert.match(sdk,/decrement\(\{application, target, settle = true\}\)/);
  assert.match(types,/interface ValueMutationResult/);
  const info=await createMacOSBackend({backendModule:{}}).info();
  for(const name of ["ui.setValue","ui.increment","ui.decrement"]) assert.equal(info.capabilities.find(x=>x.name===name)?.validationState,"IMPLEMENTED");
});
