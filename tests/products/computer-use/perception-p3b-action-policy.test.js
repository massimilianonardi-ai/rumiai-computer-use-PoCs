#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const policyPath=path.join(productRoot,"app","perception-action-policy.js");
const policyGate=require(policyPath);

function resolvedTarget(overrides={}) {
  return {
    ok:true,
    state:"VISUAL_TARGET_RESOLVED",
    actionCoordinateMapping:{
      state:"RESOLVED",display:"primary",
      validation:{state:"PHYSICALLY_VALIDATED",scope:"stable-unrotated-primary-display-topology"},
    },
    semanticTarget:{
      state:"RESOLVED",
      kind:"visual-text-region",
      query:{kind:"text",match:"exact",text:"BETA"},
      resolution:{policy:"exact-text-single-match",observationIndex:1},
      confidence:0.91,
      logicalPoint:{x:540,y:230,coordinateSpace:{kind:"primary-display-logical",origin:"top-left"}},
      semanticIdentity:null,
      actionable:false,
    },
    actionPolicy:{state:"NOT_EVALUATED"},
    persistence:{policy:"EPHEMERAL",persistedByComputerUse:false},
    ...overrides,
  };
}

const clickRequest={kind:"pointer-click",button:"left",display:"primary"};

test("P3B authorizes only an explicit primary left-click plan for a safely resolved visual target",()=>{
  const result=policyGate.evaluateVisualFallbackPolicy(resolvedTarget(),clickRequest,{allowVisualFallback:true});
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FALLBACK_AUTHORIZED");
  assert.equal(result.actionPolicy.state,"AUTHORIZED");
  assert.equal(result.actionPolicy.policy,"explicit-single-target-left-click");
  assert.equal(result.actionPolicy.basis.targetResolution,"exact-text-single-match");
  assert.equal(result.actionPolicy.basis.mappingValidation,"PHYSICALLY_VALIDATED");
  assert.equal(result.actionPolicy.basis.explicitVisualFallbackConsent,true);
  assert.deepEqual(result.actionPlan,{
    state:"READY",kind:"pointer-click",button:"left",display:"primary",
    point:{x:540,y:230,coordinateSpace:{kind:"primary-display-logical",origin:"top-left"}},
    source:"visual-target-policy",
  });
  assert.deepEqual(result.delivery,{state:"NOT_ATTEMPTED"});
  assert.deepEqual(result.semanticConsequence,{state:"NOT_OBSERVED"});
  assert.equal(result.semanticTarget.semanticIdentity,null);
  assert.equal(result.semanticTarget.actionable,false);
});

test("P3B rejects visual fallback unless consent is explicit",()=>{
  const result=policyGate.evaluateVisualFallbackPolicy(resolvedTarget(),clickRequest,{allowVisualFallback:false});
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FALLBACK_REJECTED");
  assert.equal(result.actionPolicy.state,"REJECTED");
  assert.equal(result.actionPolicy.reason,"VISUAL_FALLBACK_NOT_EXPLICITLY_ALLOWED");
  assert.deepEqual(result.actionPlan,{state:"NOT_CREATED"});
  assert.equal(result.delivery.state,"NOT_ATTEMPTED");
});

test("P3B rejects unsupported actions and unsafe targets",()=>{
  const rightClick=policyGate.evaluateVisualFallbackPolicy(resolvedTarget(),{kind:"pointer-click",button:"right",display:"primary"},{allowVisualFallback:true});
  assert.equal(rightClick.actionPolicy.reason,"ACTION_NOT_SUPPORTED_BY_INITIAL_POLICY");
  assert.equal(rightClick.actionPlan.state,"NOT_CREATED");

  const badMapping=resolvedTarget(); badMapping.actionCoordinateMapping.validation.state="IMPLEMENTED";
  const mappingRejected=policyGate.evaluateVisualFallbackPolicy(badMapping,clickRequest,{allowVisualFallback:true});
  assert.equal(mappingRejected.actionPolicy.reason,"TARGET_NOT_SAFELY_RESOLVED");

  const unresolved=resolvedTarget({state:"VISUAL_TARGET_UNRESOLVED",semanticTarget:{state:"UNRESOLVED",actionable:false,semanticIdentity:null}});
  const targetRejected=policyGate.evaluateVisualFallbackPolicy(unresolved,clickRequest,{allowVisualFallback:true});
  assert.equal(targetRejected.actionPolicy.reason,"TARGET_NOT_SAFELY_RESOLVED");
});

test("P3B rejects malformed policy rather than guessing consent",()=>{
  assert.equal(policyGate.evaluateVisualFallbackPolicy(resolvedTarget(),clickRequest,{}).error,"VISUAL_FALLBACK_POLICY_INVALID");
  assert.equal(policyGate.evaluateVisualFallbackPolicy(resolvedTarget(),clickRequest,null).error,"VISUAL_FALLBACK_POLICY_INVALID");
});

test("P3B product gate is plan-only, Computer-Control-free and persistence-free",()=>{
  const source=fs.readFileSync(policyPath,"utf8");
  const docs=fs.readFileSync(path.join(productRoot,"docs","perception.md"),"utf8");
  assert.match(source,/VISUAL_FALLBACK_AUTHORIZED/);
  assert.match(source,/VISUAL_FALLBACK_REJECTED/);
  assert.match(source,/allowVisualFallback/);
  assert.match(source,/delivery:\{state:"NOT_ATTEMPTED"\}/);
  assert.match(source,/semanticConsequence:\{state:"NOT_OBSERVED"\}/);
  assert.doesNotMatch(source,/computer-control-external|movePointer\(|clickPointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);
  assert.doesNotMatch(source,/URLSession|https?:\/\//);
  assert.match(docs,/P3B[\s\S]*explicit visual fallback action-policy gate/i);
  assert.match(docs,/delivery\.state = "NOT_ATTEMPTED"/);
  assert.match(docs,/semanticConsequence\.state = "NOT_OBSERVED"/);
});
