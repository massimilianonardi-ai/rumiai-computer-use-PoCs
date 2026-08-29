#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot)throw new Error("RUMIAI_COMPUTER_USE_ROOT is required");

const manager=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));

const scoped={
  id:"p6c.safari.canvas.proceed",
  scopeId:"p6b.safari.canvas.v1",
  application:"Safari",
  intent:"OPEN",
  target:"PROCEED",
  postcondition:"FINISHED",
  providerRequest:{capabilities:["text-region"],locality:"local"},
};

function plan(app="Safari",target="PROCEED"){
  return [
    {id:1,intent:"ACTIVATE_APP",app},
    {id:2,intent:"OPEN",target},
  ];
}

test("P6C scoped plan selection requires explicit scope and exact app/target",()=>{
  const ok=manager.selectScopedVisualFallbackContractsForPlan(plan(),{
    scopeId:"p6b.safari.canvas.v1",
    contracts:[scoped],
  });
  assert.equal(ok.ok,true);
  assert.equal(ok.state,"VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED");
  assert.equal(ok.contracts.length,1);
  assert.equal(ok.descriptors[0].id,scoped.id);
  assert.equal(ok.descriptors[0].scopeId,scoped.scopeId);

  const noScope=manager.selectScopedVisualFallbackContractsForPlan(plan(),{contracts:[scoped]});
  assert.equal(noScope.ok,false);
  assert.equal(noScope.error,"VISUAL_FALLBACK_SCOPE_REQUIRED");

  const wrongScope=manager.selectScopedVisualFallbackContractsForPlan(plan(),{
    scopeId:"other.scope",
    contracts:[scoped],
  });
  assert.equal(wrongScope.ok,true);
  assert.equal(wrongScope.state,"NO_VISUAL_FALLBACK_CONTRACT");
  assert.equal(wrongScope.contracts.length,0);

  const wrongApp=manager.selectScopedVisualFallbackContractsForPlan(plan("TextEdit"),{
    scopeId:scoped.scopeId,
    contracts:[scoped],
  });
  assert.equal(wrongApp.state,"NO_VISUAL_FALLBACK_CONTRACT");

  const wrongTarget=manager.selectScopedVisualFallbackContractsForPlan(plan("Safari","OTHER"),{
    scopeId:scoped.scopeId,
    contracts:[scoped],
  });
  assert.equal(wrongTarget.state,"NO_VISUAL_FALLBACK_CONTRACT");
});

test("P6C scoped contracts cannot be selected accidentally by the legacy unscoped lookup",()=>{
  const selected=manager.selectVisualFallbackCallerContract(
    {intent:"OPEN",target:"PROCEED"},
    {currentApp:"Safari"},
    {contracts:[scoped]}
  );
  assert.equal(selected.ok,true);
  assert.equal(selected.state,"NO_VISUAL_FALLBACK_CONTRACT");
});

test("P6C dedupes repeated use of the same scoped contract",()=>{
  const repeated=[
    {id:1,intent:"ACTIVATE_APP",app:"Safari"},
    {id:2,intent:"OPEN",target:"PROCEED"},
    {id:3,intent:"OPEN",target:"PROCEED"},
  ];
  const selected=manager.selectScopedVisualFallbackContractsForPlan(repeated,{
    scopeId:scoped.scopeId,
    contracts:[scoped],
  });
  assert.equal(selected.ok,true);
  assert.equal(selected.contracts.length,1);
  assert.equal(selected.descriptors.length,1);
});

test("P6C fails closed when one target would map to different application contracts",()=>{
  const other={...scoped,id:"p6c.textedit.proceed",application:"TextEdit"};
  const crossApp=[
    {id:1,intent:"ACTIVATE_APP",app:"Safari"},
    {id:2,intent:"OPEN",target:"PROCEED"},
    {id:3,intent:"ACTIVATE_APP",app:"TextEdit"},
    {id:4,intent:"OPEN",target:"PROCEED"},
  ];
  const selected=manager.selectScopedVisualFallbackContractsForPlan(crossApp,{
    scopeId:scoped.scopeId,
    contracts:[scoped,other],
  });
  assert.equal(selected.ok,false);
  assert.equal(selected.error,"VISUAL_FALLBACK_PLAN_TARGET_AMBIGUOUS");
});

test("P6C materialized contract contains no coordinates or concrete provider object",()=>{
  const selected=manager.selectScopedVisualFallbackContractsForPlan(plan(),{
    scopeId:scoped.scopeId,
    contracts:[scoped],
  });
  const contract=selected.contracts[0];
  assert.equal(contract.callerContract.scopeId,scoped.scopeId);
  assert.equal(contract.provider,undefined);
  const encoded=JSON.stringify(contract);
  assert.equal(/"x"\s*:/.test(encoded),false);
  assert.equal(/"y"\s*:/.test(encoded),false);
  assert.equal(contract.targetQuery.match,"exact");
  assert.equal(contract.postcondition.match,"exact");
  assert.equal(contract.policy.allowVisualFallback,true);
});

test("P6C remains caller knowledge only and does not move provider selection or planner policy",()=>{
  const managerSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-contract-manager.js"),"utf8");
  const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");
  assert.equal(managerSource.includes("perception-provider-manager"),false);
  assert.equal(managerSource.includes("computer-control"),false);
  assert.equal(managerSource.includes("runVisualTextFallback"),false);
  assert.equal(/visualFallback|scopeId|postcondition|providerRequest/.test(plannerSource),false);
});
