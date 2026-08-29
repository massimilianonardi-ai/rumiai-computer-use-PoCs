#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot)throw new Error("RUMIAI_COMPUTER_USE_ROOT is required");

const manager=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));
const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
const execution=require(path.join(productRoot,"app","visual-fallback-execution-context.js"));

const rawContract={
  id:"p6d.safari.canvas.proceed",
  scopeId:"p6d.safari.canvas.alpha",
  application:"Safari",
  intent:"OPEN",
  target:"PROCEED",
  postcondition:"FINISHED",
  surfacePrecondition:{kind:"window-title",match:"exact",text:"P6D SURFACE ALPHA"},
  providerRequest:{capabilities:["text-region"],locality:"local"},
};

const plan=[
  {id:1,intent:"ACTIVATE_APP",app:"Safari"},
  {id:2,intent:"OPEN",target:"PROCEED"},
];

function executionContract(){
  const selected=manager.selectScopedVisualFallbackContractsForPlan(plan,{
    scopeId:rawContract.scopeId,
    contracts:[rawContract],
  });
  assert.equal(selected.ok,true);
  assert.equal(selected.contracts.length,1);
  return selected.contracts[0];
}

function wrappedWindow(title){
  return {field:"window",value:{id:"w1",title,process:"Safari",pid:123,focused:true,pinned:false}};
}

test("P6D carries an exact window-title surface precondition without planner or delivery details",()=>{
  const normalized=manager.normalizeContract(rawContract,"test");
  assert.deepEqual(normalized.surfacePrecondition,{
    kind:"window-title",
    match:"exact",
    text:"P6D SURFACE ALPHA",
  });

  const contract=executionContract();
  assert.deepEqual(contract.surfacePrecondition,normalized.surfacePrecondition);
  assert.equal(contract.provider,undefined);
  const encoded=JSON.stringify(contract);
  assert.equal(/"x"\s*:|"y"\s*:/.test(encoded),false);
});

test("P6D keeps semantic-text surface preconditions exact, single-match and fail-closed",()=>{
  const precondition={kind:"semantic-text",match:"exact",text:"P6D SURFACE ALPHA"};
  const good=surface.evaluateSemanticSurfacePrecondition(precondition,{
    state:{snapshot:'@e1 heading "P6D SURFACE ALPHA"\n'},
  });
  assert.equal(good.ok,true);
  assert.equal(good.state,"SURFACE_PRECONDITION_VERIFIED");
  assert.equal(good.metadata.matchCount,1);

  const missing=surface.evaluateSemanticSurfacePrecondition(precondition,{
    state:{snapshot:'@e1 heading "P6D SURFACE BETA"\n'},
  });
  assert.equal(missing.ok,false);
  assert.equal(missing.reason,"SURFACE_PRECONDITION_NOT_MET");

  const ambiguous=surface.evaluateSemanticSurfacePrecondition(precondition,{
    state:{snapshot:'@e1 heading "P6D SURFACE ALPHA"\n@e2 static-text "P6D SURFACE ALPHA"\n'},
  });
  assert.equal(ambiguous.ok,false);
  assert.equal(ambiguous.reason,"SURFACE_PRECONDITION_AMBIGUOUS");
});

test("P6D unwraps the real Computer Control current-window descriptor before exact title comparison",()=>{
  const precondition={kind:"window-title",match:"exact",text:"P6D SURFACE ALPHA"};
  const good=surface.evaluateSemanticSurfacePrecondition(precondition,{currentWindow:wrappedWindow("P6D SURFACE ALPHA")});
  assert.equal(good.ok,true);
  assert.equal(good.state,"SURFACE_PRECONDITION_VERIFIED");

  const bad=surface.evaluateSemanticSurfacePrecondition(precondition,{currentWindow:wrappedWindow("P6D SURFACE BETA")});
  assert.equal(bad.ok,false);
  assert.equal(bad.reason,"SURFACE_PRECONDITION_NOT_MET");
});

test("P6D window-title precondition uses fresh window observation before provider selection",()=>{
  const contract=executionContract();
  let windowCalls=0,selectCalls=0;
  const result=execution.resolveOpenVisualFallbackExecutionContext({
    intent:{intent:"OPEN",target:"PROCEED"},
    contract,
    runtimeContext:{state:{currentApp:"Safari",snapshot:"@e1 web-area"}},
  },{
    observeCurrentWindow:()=>{
      windowCalls++;
      return {ok:true,window:wrappedWindow("P6D SURFACE BETA")};
    },
    selectProvider:()=>{selectCalls++;return {ok:false,error:"SHOULD_NOT_RUN"};},
  });

  assert.equal(result.ok,false);
  assert.equal(result.reason,"SURFACE_PRECONDITION_NOT_MET");
  assert.equal(windowCalls,1);
  assert.equal(selectCalls,0);
});

test("P6D verified window-title surface allows the existing lazy provider path",()=>{
  const contract=executionContract();
  let windowCalls=0,selectCalls=0;
  const provider={id:"test.local",locality:"local",capabilities:["text-region"]};
  const result=execution.resolveOpenVisualFallbackExecutionContext({
    intent:{intent:"OPEN",target:"PROCEED"},
    contract,
    runtimeContext:{state:{currentApp:"Safari",snapshot:"@e1 web-area"}},
  },{
    observeCurrentWindow:()=>{
      windowCalls++;
      return {ok:true,window:wrappedWindow("P6D SURFACE ALPHA")};
    },
    selectProvider:()=>{
      selectCalls++;
      return {
        ok:true,
        provider,
        descriptor:provider,
        selection:{locality:"local"},
      };
    },
  });

  assert.equal(result.ok,true);
  assert.equal(windowCalls,1);
  assert.equal(selectCalls,1);
  assert.equal(result.metadata.surfacePrecondition.state,"VERIFIED");
  assert.equal(result.metadata.surfacePrecondition.kind,"window-title");
  assert.equal(result.metadata.provider.id,"test.local");
});

test("P6D window-title observation failure fails closed before provider selection",()=>{
  const contract=executionContract();
  let selectCalls=0;
  const result=execution.resolveOpenVisualFallbackExecutionContext({
    intent:{intent:"OPEN",target:"PROCEED"},
    contract,
    runtimeContext:{state:{currentApp:"Safari",snapshot:"@e1 web-area"}},
  },{
    observeCurrentWindow:()=>({ok:false,error:"WINDOW_UNAVAILABLE"}),
    selectProvider:()=>{selectCalls++;return {ok:false,error:"SHOULD_NOT_RUN"};},
  });
  assert.equal(result.ok,false);
  assert.equal(result.reason,"SURFACE_PRECONDITION_WINDOW_OBSERVATION_FAILED");
  assert.equal(selectCalls,0);
});

test("P6D remains additive: P6C contracts without a surface precondition still resolve",()=>{
  const legacy={...rawContract};
  delete legacy.surfacePrecondition;
  const selected=manager.selectScopedVisualFallbackContractsForPlan(plan,{
    scopeId:legacy.scopeId,
    contracts:[legacy],
  });
  assert.equal(selected.ok,true);
  assert.equal(selected.contracts.length,1);
  assert.equal(selected.contracts[0].surfacePrecondition,undefined);
});

test("P6D keeps surface identity outside planner and provider selection policy",()=>{
  const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");
  const managerSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-contract-manager.js"),"utf8");
  const surfaceSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-surface-precondition.js"),"utf8");
  const executionSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-execution-context.js"),"utf8");
  assert.equal(/surfacePrecondition|scopeId|postcondition|providerRequest/.test(plannerSource),false);
  assert.equal(managerSource.includes("computer-control"),false);
  assert.equal(managerSource.includes("perception-provider-manager"),false);
  assert.equal(surfaceSource.includes("computer-control"),false);
  assert.equal(surfaceSource.includes("perception-provider-manager"),false);
  assert.equal(executionSource.includes("getCurrentWindow"),true);
  assert.equal(executionSource.indexOf("observeCurrentWindow")<executionSource.indexOf("selectProvider(validated.value.providerRequest"),true);
});
