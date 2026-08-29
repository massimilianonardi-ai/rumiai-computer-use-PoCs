#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const eligibilityPath=path.join(productRoot,"app","semantic-visual-fallback-eligibility.js");
const semanticUiPath=path.join(productRoot,"app","semantic-ui.js");
const coordinatorPath=path.join(productRoot,"app","perception-action-coordinator.js");
const eligibility=require(eligibilityPath);
const semanticUi=require(semanticUiPath);

const {SEMANTIC_RESULT_CODES,classifySemanticToVisualFallbackEligibility}=eligibility;

test("P5B makes only semantic observability/resolution gaps visually eligible",()=>{
  for (const code of [
    SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,
    SEMANTIC_RESULT_CODES.SURFACE_NOT_OBSERVABLE,
  ]) {
    const result=classifySemanticToVisualFallbackEligibility({ok:false,code,error:"irrelevant text"});
    assert.equal(result.ok,true);
    assert.equal(result.state,"VISUAL_FALLBACK_ELIGIBLE");
    assert.equal(result.eligible,true);
    assert.equal(result.code,code);
  }
});

test("P5B keeps action, verification, readiness, backend, internal and invalid-input failures ineligible",()=>{
  for (const code of [
    SEMANTIC_RESULT_CODES.APPLICATION_NOT_READY,
    SEMANTIC_RESULT_CODES.PERMISSION_OR_BACKEND_BLOCKED,
    SEMANTIC_RESULT_CODES.SEMANTIC_ACTION_DELIVERY_FAILED,
    SEMANTIC_RESULT_CODES.SEMANTIC_POSTCONDITION_VERIFICATION_FAILED,
    SEMANTIC_RESULT_CODES.INTERNAL_EXCEPTION,
    SEMANTIC_RESULT_CODES.INVALID_INTENT,
    SEMANTIC_RESULT_CODES.INVALID_PRECONDITION,
  ]) {
    const result=classifySemanticToVisualFallbackEligibility({ok:false,code,error:"no semantic target"});
    assert.equal(result.ok,true);
    assert.equal(result.state,"VISUAL_FALLBACK_INELIGIBLE");
    assert.equal(result.eligible,false);
    assert.equal(result.code,code);
  }
});

test("P5B never parses free-form error text to decide visual eligibility",()=>{
  const eligibleDespiteText=classifySemanticToVisualFallbackEligibility({
    ok:false,
    code:SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,
    error:"permission backend blocked verification failed",
  });
  assert.equal(eligibleDespiteText.eligible,true);

  const ineligibleDespiteText=classifySemanticToVisualFallbackEligibility({
    ok:false,
    code:SEMANTIC_RESULT_CODES.SEMANTIC_ACTION_DELIVERY_FAILED,
    error:"NO_SEMANTIC_TARGET SURFACE_NOT_OBSERVABLE",
  });
  assert.equal(ineligibleDespiteText.eligible,false);
});

test("P5B fails closed for missing or unknown structured failure codes",()=>{
  for (const input of [
    null,
    "NO_SEMANTIC_TARGET",
    {},
    {ok:false,error:"no semantic target"},
    {ok:false,code:"SOME_NEW_FAILURE"},
  ]) {
    const result=classifySemanticToVisualFallbackEligibility(input);
    assert.equal(result.eligible,false);
    assert.equal(result.ok,false);
    assert.equal(result.state,"SEMANTIC_VISUAL_ELIGIBILITY_UNCLASSIFIED");
  }
});

test("P5B never considers an already successful semantic path eligible",()=>{
  const result=classifySemanticToVisualFallbackEligibility({ok:true,code:"SEMANTIC_TARGET_RESOLVED"});
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FALLBACK_INELIGIBLE");
  assert.equal(result.eligible,false);
  assert.equal(result.reason,"SEMANTIC_PATH_SUCCEEDED");
});

test("P5B semantic target resolution emits structured codes without changing successful semantic resolution",()=>{
  const missing=semanticUi.resolveSemanticTarget('@e1 button "Other"',"Wanted",null,"CLICK",null);
  assert.equal(missing.ok,false);
  assert.equal(missing.code,SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET);
  assert.equal(classifySemanticToVisualFallbackEligibility(missing).eligible,true);

  const invalid=semanticUi.resolveSemanticTarget('@e1 button "Other"',"   ",null,"CLICK",null);
  assert.equal(invalid.ok,false);
  assert.equal(invalid.code,SEMANTIC_RESULT_CODES.INVALID_INTENT);
  assert.equal(classifySemanticToVisualFallbackEligibility(invalid).eligible,false);

  const resolved=semanticUi.resolveSemanticTarget('@e1 button "Wanted"',"Wanted",null,"CLICK",null);
  assert.equal(resolved.ok,true);
  assert.equal(resolved.ref,"@e1");
  assert.equal(resolved.role,"button");
});

test("P5B remains classification-only and does not invoke P5A, perception, Computer Control or persistence",()=>{
  const source=fs.readFileSync(eligibilityPath,"utf8");
  assert.doesNotMatch(source,/result\.error|\.error\s*\)|match\(|includes\(|RegExp|regex/i);
  assert.doesNotMatch(source,/perception-action-coordinator|runVisualTextFallback|perception-provider|perception-target/);
  assert.doesNotMatch(source,/computer-control-external|agent-ctrl|https?:\/\//);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|createWriteStream/);

  const semanticSource=fs.readFileSync(semanticUiPath,"utf8");
  assert.match(semanticSource,/code:SEMANTIC_RESULT_CODES\.NO_SEMANTIC_TARGET/);
  assert.match(semanticSource,/code:SEMANTIC_RESULT_CODES\.INVALID_INTENT/);

  const coordinatorSource=fs.readFileSync(coordinatorPath,"utf8");
  assert.doesNotMatch(coordinatorSource,/semantic-visual-fallback-eligibility|classifySemanticToVisualFallbackEligibility/);
});
