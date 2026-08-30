#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot)throw new Error("RUMIAI_COMPUTER_USE_ROOT is required");

const pulsarContract=require(path.join(productRoot,"app","pulsar-encoding-selector-visual-contract.js"));

function plan(app="Pulsar",target="UTF-8"){
  return [
    {id:1,intent:"ACTIVATE_APP",app},
    {id:2,intent:"OPEN",target},
  ];
}

test("P7D canonicalizes only the bounded macOS /var alias for caller-owned document paths",()=>{
  assert.equal(
    pulsarContract.canonicalizeMacosCallerPath("/var/folders/aa/test.js"),
    "/private/var/folders/aa/test.js"
  );
  assert.equal(
    pulsarContract.canonicalizeMacosCallerPath("/private/var/folders/aa/test.js"),
    "/private/var/folders/aa/test.js"
  );
  assert.equal(
    pulsarContract.canonicalizeMacosCallerPath("/Users/example/test.js"),
    "/Users/example/test.js"
  );
  assert.equal(pulsarContract.canonicalizeMacosCallerPath("relative/test.js"),null);
  assert.equal(pulsarContract.canonicalizeMacosCallerPath(""),null);
});

test("P7D derives an exact Pulsar current-document title only from caller-owned path information",()=>{
  const derived=pulsarContract.derivePulsarDocumentWindowTitle("/var/folders/aa/work/sample.js");
  assert.equal(derived.ok,true);
  assert.equal(derived.state,"PULSAR_DOCUMENT_SURFACE_DERIVED");
  assert.equal(derived.document.fileName,"sample.js");
  assert.equal(derived.document.parentPath,"/private/var/folders/aa/work");
  assert.equal(derived.windowTitle,"sample.js — /private/var/folders/aa/work");

  const invalid=pulsarContract.derivePulsarDocumentWindowTitle("sample.js");
  assert.equal(invalid.ok,false);
  assert.equal(invalid.error,"PULSAR_DOCUMENT_PATH_INVALID");
  assert.equal(invalid.recoveryPolicy,"NONE");
});

test("P7D materializes only the physically validated Pulsar UTF-8 caller contract",()=>{
  const result=pulsarContract.materializePulsarUtf8VisualFallbackCallerContract({
    documentPath:"/private/var/folders/aa/work/sample.js",
  });
  assert.equal(result.ok,true);
  assert.equal(result.scopeId,"pulsar.encoding-selector.current-document.v1");
  assert.equal(result.contract.id,"pulsar.encoding-selector.open.utf8.v1");
  assert.equal(result.contract.application,"Pulsar");
  assert.equal(result.contract.intent,"OPEN");
  assert.equal(result.contract.target,"UTF-8");
  assert.equal(result.contract.postcondition,"UTF-16 LE");
  assert.deepEqual(result.contract.surfacePrecondition,{
    kind:"window-title",
    match:"exact",
    text:"sample.js — /private/var/folders/aa/work",
  });
  assert.deepEqual(result.contract.providerRequest,{
    capabilities:["text-region"],
    locality:"local",
  });

  const encoded=JSON.stringify(result.contract);
  assert.equal(/"providerId"\s*:/.test(encoded),false);
  assert.equal(/"provider"\s*:/.test(encoded),false);
  assert.equal(/"x"\s*:/.test(encoded),false);
  assert.equal(/"y"\s*:/.test(encoded),false);
  assert.equal(encoded.includes("JavaScript"),false);
});

test("P7D selection is exact on Pulsar plus OPEN UTF-8 and fails closed for other app/targets",()=>{
  const options={documentPath:"/var/folders/aa/work/sample.js"};

  const selected=pulsarContract.selectPulsarUtf8VisualFallbackContractsForPlan(plan(),options);
  assert.equal(selected.ok,true);
  assert.equal(selected.state,"VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED");
  assert.equal(selected.contracts.length,1);
  assert.equal(selected.descriptors.length,1);
  assert.equal(selected.descriptors[0].id,"pulsar.encoding-selector.open.utf8.v1");
  assert.equal(selected.descriptors[0].scopeId,"pulsar.encoding-selector.current-document.v1");
  assert.equal(selected.contracts[0].targetQuery.text,"UTF-8");
  assert.equal(selected.contracts[0].targetQuery.match,"exact");
  assert.equal(selected.contracts[0].postcondition.text,"UTF-16 LE");
  assert.equal(selected.contracts[0].postcondition.match,"exact");
  assert.equal(selected.contracts[0].surfacePrecondition.kind,"window-title");
  assert.equal(selected.contracts[0].surfacePrecondition.match,"exact");
  assert.equal(selected.contracts[0].policy.allowVisualFallback,true);

  const wrongApp=pulsarContract.selectPulsarUtf8VisualFallbackContractsForPlan(
    plan("TextEdit","UTF-8"),options
  );
  assert.equal(wrongApp.ok,true);
  assert.equal(wrongApp.state,"NO_VISUAL_FALLBACK_CONTRACT");
  assert.equal(wrongApp.contracts.length,0);

  const wrongTarget=pulsarContract.selectPulsarUtf8VisualFallbackContractsForPlan(
    plan("Pulsar","JavaScript"),options
  );
  assert.equal(wrongTarget.ok,true);
  assert.equal(wrongTarget.state,"NO_VISUAL_FALLBACK_CONTRACT");
  assert.equal(wrongTarget.contracts.length,0);
});

test("P7D supports an explicit caller-owned initial Pulsar context without inventing planner fields",()=>{
  const semanticPlan=[{id:1,intent:"OPEN",target:"UTF-8"}];
  const before=JSON.stringify(semanticPlan);
  const selected=pulsarContract.selectPulsarUtf8VisualFallbackContractsForPlan(semanticPlan,{
    documentPath:"/Users/example/project/sample.js",
    initialApplication:"Pulsar",
  });
  assert.equal(selected.ok,true);
  assert.equal(selected.state,"VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED");
  assert.equal(JSON.stringify(semanticPlan),before);
  assert.equal(/visualFallback|scopeId|surfacePrecondition|postcondition|providerRequest|"x"|"y"/.test(before),false);
});

test("P7D fails closed before contract selection when caller document context is missing or invalid",()=>{
  for(const documentPath of [undefined,"","sample.js"]){
    const result=pulsarContract.selectPulsarUtf8VisualFallbackContractsForPlan(plan(),{documentPath});
    assert.equal(result.ok,false);
    assert.equal(result.error,"PULSAR_DOCUMENT_PATH_INVALID");
    assert.equal(result.recoveryPolicy,"NONE");
  }
});

test("P7D remains caller-knowledge only: no perception, Computer Control, planner or execution side effects",()=>{
  const source=fs.readFileSync(
    path.join(productRoot,"app","pulsar-encoding-selector-visual-contract.js"),
    "utf8"
  );
  const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");

  assert.equal(source.includes("computer-control"),false);
  assert.equal(source.includes("perception-provider-manager"),false);
  assert.equal(source.includes("runVisualTextFallback"),false);
  assert.equal(source.includes("agent-loop"),false);
  assert.equal(source.includes("clickPointer"),false);
  assert.equal(/visualFallback|scopeId|surfacePrecondition|postcondition|providerRequest/.test(plannerSource),false);
});
