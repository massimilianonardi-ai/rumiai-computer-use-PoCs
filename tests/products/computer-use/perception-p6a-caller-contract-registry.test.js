#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const manager=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));

function withDir(files,fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6a-contract-"));
  try{
    for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2));
    return fn(dir);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

const base={
  id:"fixture.open.visual",
  application:"FixtureApp",
  intent:"OPEN",
  target:"OPEN ME",
  postcondition:"DONE",
  providerRequest:{capabilities:["text-region"],locality:"local"},
};

test("P6A loads a deterministic local caller contract and converts it to the P5E execution shape",()=>{
  withDir({"contract.json":base},dir=>{
    const loaded=manager.loadVisualFallbackContracts({directory:dir});
    assert.equal(loaded.length,1);
    assert.equal(loaded[0].id,base.id);
    assert.equal(loaded[0].application,"FixtureApp");
    const selected=manager.selectVisualFallbackCallerContract(
      {intent:"OPEN",target:"OPEN ME"},
      {currentApp:"FixtureApp"},
      {directory:dir}
    );
    assert.equal(selected.ok,true);
    assert.equal(selected.state,"VISUAL_FALLBACK_CONTRACT_SELECTED");
    assert.equal(selected.descriptor.id,base.id);
    assert.equal(selected.contract.targetQuery.text,"OPEN ME");
    assert.equal(selected.contract.postcondition.text,"DONE");
    assert.equal(selected.contract.policy.allowVisualFallback,true);
    assert.deepEqual(selected.contract.actionRequest,{kind:"pointer-click",button:"left",display:"primary"});
    assert.deepEqual(selected.contract.providerRequest,{capabilities:["text-region"],locality:"local"});
    assert.equal(Object.hasOwn(selected.contract,"provider"),false);
  });
});

test("P6A matching is exact on application and OPEN target and produces no generic fallback",()=>{
  withDir({"contract.json":base},dir=>{
    for(const [intent,state] of [
      [{intent:"OPEN",target:"OTHER"},{currentApp:"FixtureApp"}],
      [{intent:"OPEN",target:"OPEN ME"},{currentApp:"OtherApp"}],
      [{intent:"INPUT",target:"OPEN ME"},{currentApp:"FixtureApp"}],
    ]){
      const selected=manager.selectVisualFallbackCallerContract(intent,state,{directory:dir});
      assert.equal(selected.ok,true);
      assert.equal(selected.state,"NO_VISUAL_FALLBACK_CONTRACT");
      assert.equal(selected.contract,null);
    }
  });
});

test("P6A duplicate matching contracts fail closed",()=>{
  withDir({"a.json":base,"b.json":{...base,id:"fixture.open.visual.2"}},dir=>{
    const selected=manager.selectVisualFallbackCallerContract(
      {intent:"OPEN",target:"OPEN ME"},
      {currentApp:"FixtureApp"},
      {directory:dir}
    );
    assert.equal(selected.ok,false);
    assert.equal(selected.error,"VISUAL_FALLBACK_CONTRACT_AMBIGUOUS");
    assert.deepEqual(selected.matches,["fixture.open.visual","fixture.open.visual.2"]);
  });
});

test("P6A contract schema contains no coordinates/provider object and defaults local text-region",()=>{
  const normalized=manager.normalizeContract({
    id:"minimal",
    application:"FixtureApp",
    target:"OPEN ME",
    postcondition:"DONE",
  },"minimal.json");
  assert.ok(normalized);
  const runtime=manager.contractToExecutionContract(normalized);
  assert.deepEqual(runtime.providerRequest,{capabilities:["text-region"],locality:"local"});
  assert.equal(JSON.stringify(runtime).includes('"x"'),false);
  assert.equal(JSON.stringify(runtime).includes('"y"'),false);
  assert.equal(Object.hasOwn(runtime,"provider"),false);
});

test("P6A registry is separate from competence skills and Computer Control",()=>{
  const source=fs.readFileSync(path.join(productRoot,"app","visual-fallback-contract-manager.js"),"utf8");
  assert.doesNotMatch(source,/skill-manager/);
  assert.doesNotMatch(source,/computer-control-external|agent-ctrl/);
  assert.doesNotMatch(source,/perception-provider-manager|selectPerceptionProvider/);
  assert.doesNotMatch(source,/https?:\/\//);
  assert.match(source,/RUMIAI_VISUAL_FALLBACK_CONTRACT_DIR/);
});
