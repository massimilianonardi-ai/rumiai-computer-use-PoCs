#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));

function plan(target="UTF-8",app="Pulsar"){
  return [
    {id:1,intent:"ACTIVATE_APP",app},
    {id:2,intent:"OPEN",target},
  ];
}

function resourceContext(resourcePath="/var/folders/zz/rumiai-p8c/current.js",application="Pulsar"){
  return {
    version:1,
    resources:[{
      kind:"file",
      role:"current-document",
      application,
      path:resourcePath,
    }],
  };
}

const directCallerContext={
  kind:"pulsar-document",
  documentPath:"/var/folders/zz/rumiai-p8c/current.js",
};

const explicitContracts=[{
  intent:"OPEN",
  targetQuery:{kind:"text",match:"exact",text:"OPEN ME"},
  actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
  policy:{allowVisualFallback:true},
  postcondition:{kind:"text",match:"exact",text:"DONE"},
  providerRequest:{capabilities:["text-region"],locality:"local"},
}];

test("P8C preserves no-knowledge behavior when no visual source is supplied",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{},{});
  assert.equal(resolved.ok,true);
  assert.equal(resolved.state,"NO_VISUAL_FALLBACK_CALLER_CONTEXT");
  assert.equal(resolved.source,"none");
  assert.deepEqual(resolved.contracts,[]);
});

test("P8C taskResourceContext derives the bounded P7E Pulsar UTF-8 contract after planning",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    taskResourceContext:resourceContext(),
  });

  assert.equal(resolved.ok,true);
  assert.equal(resolved.source,"task-resource-context");
  assert.equal(resolved.contracts.length,1);
  assert.equal(resolved.callerContext.kind,"pulsar-document");
  assert.equal(resolved.callerContext.application,"Pulsar");
  assert.equal(Object.hasOwn(resolved.callerContext,"documentPath"),false);
  assert.deepEqual(resolved.resource,{
    kind:"file",
    role:"current-document",
    application:"Pulsar",
  });

  const contract=resolved.contracts[0];
  assert.equal(contract.targetQuery.text,"UTF-8");
  assert.equal(contract.targetQuery.match,"exact");
  assert.equal(contract.postcondition.text,"UTF-16 LE");
  assert.equal(contract.surfacePrecondition.kind,"window-title");
  assert.equal(contract.surfacePrecondition.match,"exact");
  assert.equal(
    contract.surfacePrecondition.text,
    "current.js — /private/var/folders/zz/rumiai-p8c"
  );
  assert.equal(contract.providerRequest.locality,"local");
  assert.deepEqual(contract.providerRequest.capabilities,["text-region"]);
  assert.equal(Object.hasOwn(contract.providerRequest,"providerId"),false);

  const encoded=JSON.stringify(contract);
  assert.equal(/"x"\s*:/.test(encoded),false);
  assert.equal(/"y"\s*:/.test(encoded),false);
  assert.equal(encoded.includes("rumiai.local.macos-vision-text-region"),false);
});

test("P8C task resources do not authorize a wrong application or wrong OPEN target",()=>{
  const wrongApplication=agentLoop.resolveEffectiveVisualFallbackContracts(
    plan("UTF-8","TextEdit"),
    {},
    {taskResourceContext:resourceContext()}
  );
  assert.equal(wrongApplication.ok,true);
  assert.equal(wrongApplication.contracts.length,0);
  assert.equal(wrongApplication.state,"NO_VISUAL_FALLBACK_CONTRACT");

  const wrongTarget=agentLoop.resolveEffectiveVisualFallbackContracts(
    plan("JavaScript"),
    {},
    {taskResourceContext:resourceContext()}
  );
  assert.equal(wrongTarget.ok,true);
  assert.equal(wrongTarget.contracts.length,0);
  assert.equal(wrongTarget.state,"NO_VISUAL_FALLBACK_CONTRACT");

  const nonPulsarResource=agentLoop.resolveEffectiveVisualFallbackContracts(
    plan(),
    {},
    {taskResourceContext:resourceContext("/tmp/example.txt","TextEdit")}
  );
  assert.equal(nonPulsarResource.ok,true);
  assert.equal(nonPulsarResource.source,"task-resource-context");
  assert.equal(nonPulsarResource.state,"NO_PULSAR_DOCUMENT_RESOURCE");
  assert.deepEqual(nonPulsarResource.contracts,[]);
});

test("P8C invalid task resource provenance fails closed before visual execution",()=>{
  const relative=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    taskResourceContext:resourceContext("relative/current.js"),
  });
  assert.equal(relative.ok,false);
  assert.equal(relative.error,"TASK_RESOURCE_INVALID");
  assert.equal(relative.recoveryPolicy,"NONE");

  const ambiguous=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    taskResourceContext:{
      version:1,
      resources:[
        {kind:"file",role:"current-document",application:"Pulsar",path:"/tmp/a.js"},
        {kind:"file",role:"current-document",application:"Pulsar",path:"/tmp/b.js"},
      ],
    },
  });
  assert.equal(ambiguous.ok,false);
  assert.equal(ambiguous.error,"CURRENT_DOCUMENT_RESOURCE_AMBIGUOUS");
  assert.equal(ambiguous.recoveryPolicy,"NONE");
});

test("P8C allows at most one explicit visual knowledge source",()=>{
  const options=[
    {
      visualFallbackContracts:explicitContracts,
      visualFallbackCallerContext:directCallerContext,
    },
    {
      visualFallbackContracts:explicitContracts,
      taskResourceContext:resourceContext(),
    },
    {
      visualFallbackCallerContext:directCallerContext,
      taskResourceContext:resourceContext(),
    },
    {
      visualFallbackContracts:explicitContracts,
      visualFallbackCallerContext:directCallerContext,
      taskResourceContext:resourceContext(),
    },
  ];

  for(const candidate of options){
    const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{},candidate);
    assert.equal(resolved.ok,false);
    assert.equal(resolved.error,"VISUAL_FALLBACK_CONTRACT_SOURCE_AMBIGUOUS");
    assert.equal(resolved.recoveryPolicy,"NONE");
  }

  const direct=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    visualFallbackCallerContext:directCallerContext,
  });
  assert.equal(direct.ok,true);
  assert.equal(direct.source,"caller-context");
  assert.equal(direct.contracts.length,1);

  const explicit=agentLoop.resolveEffectiveVisualFallbackContracts(
    [{id:1,intent:"OPEN",target:"OPEN ME"}],
    {},
    {visualFallbackContracts:explicitContracts}
  );
  assert.equal(explicit.ok,true);
  assert.equal(explicit.source,"explicit-contracts");
  assert.equal(explicit.contracts,explicitContracts);
});

test("P8C keeps resource provenance outside planner, UI inference and agent-loop path knowledge",()=>{
  const agentSource=fs.readFileSync(path.join(productRoot,"app","agent-loop.js"),"utf8");
  const resourceSource=fs.readFileSync(path.join(productRoot,"app","task-resource-context.js"),"utf8");
  const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");

  assert.match(agentSource,/task-resource-context/);
  assert.match(agentSource,/taskResourceContext/);
  assert.match(agentSource,/derivePulsarVisualFallbackCallerContextFromTaskResources/);
  assert.doesNotMatch(agentSource,/\bdocumentPath\b/);
  assert.doesNotMatch(agentSource,/perception-provider-manager/);

  const planIndex=agentSource.indexOf("let plan = planned.steps");
  const resolveIndex=agentSource.indexOf("const visualFallbackSelection = resolveEffectiveVisualFallbackContracts");
  const loopIndex=agentSource.indexOf("for (let i = 0; i < plan.length; i++)");
  assert.ok(planIndex>=0&&resolveIndex>planIndex&&loopIndex>resolveIndex);

  assert.doesNotMatch(resourceSource,/computer-control|perception-provider|semantic-ui|getCurrentWindow|snapshot\(|OCR|Vision|readFile|existsSync|statSync|realpathSync/i);
  assert.doesNotMatch(plannerSource,/taskResourceContext|documentPath|filePath|visualFallbackCallerContext|surfacePrecondition|postcondition|providerRequest/);

  assert.match(agentSource,/await runTask\(task\);/);
  assert.doesNotMatch(agentSource,/await runTask\(task,\s*\{[^}]*taskResourceContext/s);
});

test("P8C materialized task-resource contract is consumed only by exact OPEN intent lookup",()=>{
  const resolved=agentLoop.resolveEffectiveVisualFallbackContracts(plan(),{}, {
    taskResourceContext:resourceContext(),
  });
  assert.equal(resolved.ok,true);

  const exact=agentLoop.visualFallbackContractForIntent(
    {intent:"OPEN",target:"UTF-8"},
    resolved.contracts
  );
  assert.ok(exact);
  assert.equal(exact.targetQuery.text,"UTF-8");

  const wrong=agentLoop.visualFallbackContractForIntent(
    {intent:"OPEN",target:"JavaScript"},
    resolved.contracts
  );
  assert.equal(wrong,null);
});
