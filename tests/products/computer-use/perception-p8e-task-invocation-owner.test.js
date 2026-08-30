#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const invocation=require(path.join(productRoot,"app","task-invocation.js"));
const invocationSource=fs.readFileSync(path.join(productRoot,"app","task-invocation.js"),"utf8");
const agentSource=fs.readFileSync(path.join(productRoot,"app","agent-loop.js"),"utf8");
const plannerSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");

function validInvocation(resourcePath="/tmp/p8e/current.js",task="Open the encoding selector for the current Pulsar document"){
  return {
    version:1,
    task,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:resourcePath,
    }],
  };
}

test("P8E normalizes one explicit pre-planner task invocation with caller-owned resources",()=>{
  const rawTask="  Open the encoding selector for the current Pulsar document  ";
  const normalized=invocation.normalizeTaskInvocation(validInvocation("/var/tmp/p8e/current.js",rawTask));
  assert.equal(normalized.ok,true);
  assert.equal(normalized.state,"TASK_INVOCATION_NORMALIZED");
  assert.equal(normalized.invocation.version,1);
  assert.equal(normalized.invocation.task,rawTask);
  assert.deepEqual(normalized.invocation.taskResourceContext,{
    version:1,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:"/var/tmp/p8e/current.js",
    }],
  });
  assert.equal(Object.isFrozen(normalized.invocation),true);
  assert.equal(Object.isFrozen(normalized.invocation.taskResourceContext),true);
  assert.equal(Object.isFrozen(normalized.invocation.taskResourceContext.resources),true);
  assert.equal(Object.isFrozen(normalized.invocation.taskResourceContext.resources[0]),true);
});

test("P8E invocation schema fails closed on unsupported version, task and resource shapes",()=>{
  const wrongVersion=invocation.normalizeTaskInvocation({...validInvocation(),version:2});
  assert.equal(wrongVersion.ok,false);
  assert.equal(wrongVersion.error,"TASK_INVOCATION_VERSION_UNSUPPORTED");

  for(const taskValue of ["", "   ", null, 123]){
    const invalid=invocation.normalizeTaskInvocation({...validInvocation(),task:taskValue});
    assert.equal(invalid.ok,false);
    assert.equal(invalid.error,"TASK_INVOCATION_TASK_INVALID");
  }

  const tooLong=invocation.normalizeTaskInvocation({...validInvocation(),task:"x".repeat(invocation.MAX_TASK_CHARS+1)});
  assert.equal(tooLong.ok,false);
  assert.equal(tooLong.error,"TASK_INVOCATION_TASK_INVALID");

  const missingResources=invocation.normalizeTaskInvocation({version:1,task:"x"});
  assert.equal(missingResources.ok,false);
  assert.equal(missingResources.error,"TASK_INVOCATION_RESOURCES_INVALID");

  const relative=invocation.normalizeTaskInvocation(validInvocation("relative/current.js"));
  assert.equal(relative.ok,false);
  assert.equal(relative.error,"TASK_RESOURCE_INVALID");
});

test("P8E invocation boundary rejects alternate or hidden visual knowledge fields",()=>{
  const forbidden=[
    ["documentPath","/tmp/p8e/current.js"],
    ["taskResourceContext",{version:1,resources:[]}],
    ["visualFallbackCallerContext",{kind:"pulsar-document",documentPath:"/tmp/p8e/current.js"}],
    ["visualFallbackContracts",[]],
    ["visualFallbackDependencies",{}],
    ["options",{}],
  ];

  for(const [key,value] of forbidden){
    const raw={...validInvocation(),[key]:value};
    const result=invocation.normalizeTaskInvocation(raw);
    assert.equal(result.ok,false,key);
    assert.equal(result.error,"TASK_INVOCATION_FIELD_UNSUPPORTED",key);
    assert.equal(result.recoveryPolicy,"NONE",key);
  }
});

test("P8E product caller invokes runTask exactly once with taskResourceContext as its only option",async()=>{
  const calls=[];
  const rawTask="Open UTF-8 exactly";
  const raw=validInvocation("/var/tmp/p8e/current.js",rawTask);

  const result=await invocation.runTaskInvocation(raw,{
    runTask:async(task,options)=>{
      calls.push({task,options});
      return {ok:true,state:{currentApp:"Pulsar"},intentResults:[]};
    },
  });

  assert.equal(result.ok,true);
  assert.equal(result.state,"TASK_INVOCATION_COMPLETED");
  assert.equal(calls.length,1);
  assert.equal(calls[0].task,rawTask);
  assert.deepEqual(Object.keys(calls[0].options),["taskResourceContext"]);
  assert.deepEqual(calls[0].options.taskResourceContext,{
    version:1,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:"/var/tmp/p8e/current.js",
    }],
  });
});

test("P8E invalid invocation never reaches runTask and failed runTask is not retried",async()=>{
  let calls=0;
  const invalid=await invocation.runTaskInvocation({...validInvocation(),documentPath:"/tmp/hidden.js"},{
    runTask:async()=>{calls++;return {ok:true};},
  });
  assert.equal(invalid.ok,false);
  assert.equal(invalid.error,"TASK_INVOCATION_FIELD_UNSUPPORTED");
  assert.equal(calls,0);

  const failed=await invocation.runTaskInvocation(validInvocation(),{
    runTask:async()=>{calls++;return {ok:false,error:"semantic failure"};},
  });
  assert.equal(failed.ok,false);
  assert.equal(failed.state,"TASK_INVOCATION_FAILED");
  assert.equal(calls,1);
});

test("P8E invocation owner performs no UI, perception, planner or filesystem path discovery",()=>{
  assert.match(invocationSource,/task-resource-context/);
  assert.match(invocationSource,/require\("\.\/agent-loop"\)\.runTask/);
  assert.doesNotMatch(invocationSource,/computer-control|perception-provider|perception\.js|semantic-ui|getCurrentWindow|snapshot\(|OCR|Vision|realpathSync|statSync|existsSync/i);
  assert.doesNotMatch(invocationSource,/visualFallbackContracts|visualFallbackCallerContext|documentPath|surfacePrecondition|postcondition|providerRequest/);
  assert.match(invocationSource,/readFileSync\(0/);

  assert.doesNotMatch(agentSource,/require\("\.\/task-invocation"\)/);
  assert.match(agentSource,/await runTask\(task\);/);
  assert.doesNotMatch(agentSource,/\bdocumentPath\b/);

  assert.doesNotMatch(plannerSource,/taskResourceContext|visualFallbackCallerContext|visualFallbackContracts|documentPath|scopeId|surfacePrecondition|providerRequest/);
});

test("P8E resource ownership remains task/run bounded and cannot silently become default CLI state",()=>{
  assert.match(invocationSource,/runTaskFn\(normalized\.invocation\.task,\{\s*taskResourceContext:/s);
  assert.doesNotMatch(invocationSource,/global\.|computerSessionState|contextSession|currentWindow|foreground/i);
  assert.match(agentSource,/rl\.question\("Agent task> "/);
  assert.match(agentSource,/await runTask\(task\);/);
  assert.doesNotMatch(agentSource,/taskResourceContext\s*=/);
});
