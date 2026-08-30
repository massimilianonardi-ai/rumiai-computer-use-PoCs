#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
const callerContext=require(path.join(productRoot,"app","visual-fallback-caller-context.js"));

function plan(target="UTF-8",app="Pulsar"){
  return [
    {id:1,intent:"ACTIVATE_APP",app},
    {id:2,intent:"OPEN",target},
  ];
}

const documentPath="/var/folders/zz/rumiai-p7e/current.js";

test("P7E resolves no visual knowledge when caller context is absent",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{},{});
  assert.equal(resolved.ok,true);
  assert.equal(resolved.state,"NO_VISUAL_FALLBACK_CALLER_CONTEXT");
  assert.deepEqual(resolved.contracts,[]);
  assert.equal(resolved.source,"none");
});

test("P7E explicit pulsar-document caller context materializes one bounded UTF-8 contract",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackCallerContext:{kind:"pulsar-document",documentPath},
  });
  assert.equal(resolved.ok,true);
  assert.equal(resolved.source,"caller-context");
  assert.equal(resolved.contracts.length,1);
  assert.equal(resolved.callerContext.kind,"pulsar-document");
  assert.equal(resolved.callerContext.application,"Pulsar");
  assert.equal(Object.hasOwn(resolved.callerContext,"documentPath"),false);

  const contract=resolved.contracts[0];
  assert.equal(contract.targetQuery.text,"UTF-8");
  assert.equal(contract.targetQuery.match,"exact");
  assert.equal(contract.postcondition.text,"UTF-16 LE");
  assert.equal(contract.postcondition.match,"exact");
  assert.equal(contract.surfacePrecondition.kind,"window-title");
  assert.equal(contract.surfacePrecondition.match,"exact");
  assert.equal(contract.surfacePrecondition.text,"current.js — /private/var/folders/zz/rumiai-p7e");
  assert.equal(contract.providerRequest.locality,"local");
  assert.deepEqual(contract.providerRequest.capabilities,["text-region"]);
  assert.equal(Object.hasOwn(contract.providerRequest,"providerId"),false);
  assert.equal(contract.callerContract.application,"Pulsar");
  assert.equal(contract.callerContract.scopeId,"pulsar.encoding-selector.current-document.v1");

  const encoded=JSON.stringify(contract);
  assert.equal(/"x"\s*:/.test(encoded),false);
  assert.equal(/"y"\s*:/.test(encoded),false);
  assert.equal(encoded.includes("rumiai.local.macos-vision-text-region"),false);
});

test("P7E caller context does not authorize wrong target or wrong application",()=>{
  for(const candidate of [plan("JavaScript"),plan("UTF-8","TextEdit")]){
    const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(candidate,{}, {
      visualFallbackCallerContext:{kind:"pulsar-document",documentPath},
    });
    assert.equal(resolved.ok,true);
    assert.equal(resolved.contracts.length,0);
    assert.equal(resolved.state,"NO_VISUAL_FALLBACK_CONTRACT");
  }
});

test("P7E invalid or unsupported caller context fails closed",()=>{
  const invalidShape=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackCallerContext:{kind:"pulsar-document",documentPath:"relative.js"},
  });
  assert.equal(invalidShape.ok,false);
  assert.equal(invalidShape.error,"PULSAR_DOCUMENT_PATH_INVALID");
  assert.equal(invalidShape.recoveryPolicy,"NONE");

  const unsupported=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackCallerContext:{kind:"generic-window",documentPath},
  });
  assert.equal(unsupported.ok,false);
  assert.equal(unsupported.error,"VISUAL_FALLBACK_CALLER_CONTEXT_UNSUPPORTED");
  assert.equal(unsupported.recoveryPolicy,"NONE");
});

test("P7E rejects ambiguous dual contract sources and preserves explicit-contract compatibility",()=>{
  const explicit=[{
    intent:"OPEN",
    targetQuery:{kind:"text",match:"exact",text:"OPEN ME"},
    actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
    policy:{allowVisualFallback:true},
    postcondition:{kind:"text",match:"exact",text:"DONE"},
    providerRequest:{capabilities:["text-region"],locality:"local"},
  }];

  const preserved=agentLoop.resolveEffectiveVisualFallbackContracts(
    [{id:1,intent:"OPEN",target:"OPEN ME"}],
    {},
    {visualFallbackContracts:explicit}
  );
  assert.equal(preserved.ok,true);
  assert.equal(preserved.source,"explicit-contracts");
  assert.equal(preserved.contracts,explicit);

  const ambiguous=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackContracts:explicit,
    visualFallbackCallerContext:{kind:"pulsar-document",documentPath},
  });
  assert.equal(ambiguous.ok,false);
  assert.equal(ambiguous.error,"VISUAL_FALLBACK_CONTRACT_SOURCE_AMBIGUOUS");
  assert.equal(ambiguous.recoveryPolicy,"NONE");
});

test("P7E caller-context resolver remains pure caller knowledge outside planner and Computer Control",()=>{
  const callerSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-caller-context.js"),"utf8");
  const pulsarSource=fs.readFileSync(path.join(productRoot,"app","pulsar-encoding-selector-visual-contract.js"),"utf8");
  const agentSource=fs.readFileSync(path.join(productRoot,"app","agent-loop.js"),"utf8");
  const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");

  assert.match(callerSource,/selectPulsarUtf8VisualFallbackContractsForPlan/);
  assert.doesNotMatch(callerSource,/computer-control|perception-provider-manager|runVisualTextFallback|acquireMappedPrimaryVisualFrame/);
  assert.doesNotMatch(pulsarSource,/computer-control|perception-provider-manager|runVisualTextFallback|acquireMappedPrimaryVisualFrame/);

  assert.match(agentSource,/visual-fallback-caller-context/);
  assert.match(agentSource,/visualFallbackCallerContext/);
  assert.match(agentSource,/resolveEffectiveVisualFallbackContracts/);
  assert.doesNotMatch(agentSource,/\bdocumentPath\b/);
  assert.doesNotMatch(agentSource,/perception-provider-manager/);

  const planIndex=agentSource.indexOf("let plan = planned.steps");
  const resolveIndex=agentSource.indexOf("const visualFallbackSelection = resolveEffectiveVisualFallbackContracts");
  const loopIndex=agentSource.indexOf("for (let i = 0; i < plan.length; i++)");
  assert.ok(planIndex>=0&&resolveIndex>planIndex&&loopIndex>resolveIndex);

  assert.doesNotMatch(plannerSource,/visualFallbackCallerContext|visualFallback|scopeId|surfacePrecondition|postcondition|providerRequest/);
  assert.doesNotMatch(plannerSource,/\bx\s*:|\by\s*:/);
});

test("P7E intent lookup consumes only the materialized execution contract",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackCallerContext:{kind:callerContext.PULSAR_DOCUMENT_CALLER_CONTEXT_KIND,documentPath},
  });
  assert.equal(resolved.ok,true);
  const contract=agentLoop.visualFallbackContractForIntent(
    {intent:"OPEN",target:"UTF-8"},
    resolved.contracts
  );
  assert.ok(contract);
  assert.equal(contract.targetQuery.text,"UTF-8");

  const wrong=agentLoop.visualFallbackContractForIntent(
    {intent:"OPEN",target:"JavaScript"},
    resolved.contracts
  );
  assert.equal(wrong,null);
});
