"use strict";
const assert=require("node:assert/strict"),path=require("node:path"),test=require("node:test");
const root=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.resolve(__dirname,"../../../../../../lib/computer-control");
const {parseDirectChildren,createMacOSBackend}=require(path.join(root,"backends/macos/backend"));
const {createRouter}=require(path.join(root,"runtime/src/router"));
test("indentation yields direct children only",()=>{const s='@e0 group "root"\n  @e1 button "A"\n    @e2 static-text "nested"\n  @e3 checkbox "B"\n@e4 button "outside"';const r=parseDirectChildren(s,"@e0");assert.equal(r.found,true);assert.deepEqual(r.children.map(x=>x.ref),["@e1","@e3"]);});
test("children pagination is validated",async()=>{const backend={info:async()=>({}),children:async p=>p};const route=createRouter(backend);assert.equal((await route("ui.children",{application:"Safari",target:{ref:"@e1"},offset:1,limit:2})).limit,2);await assert.rejects(route("ui.children",{application:"Safari",target:{ref:"@e1"},limit:201}),e=>e.code==="INVALID_PAGINATION");});
test("capability remains IMPLEMENTED",async()=>{const info=await createMacOSBackend({backendModule:{}}).info();assert.equal(info.capabilities.find(x=>x.name==="ui.children")?.validationState,"IMPLEMENTED");});
