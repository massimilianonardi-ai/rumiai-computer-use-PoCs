#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const node=process.env.RUMIAI_CC_NODE||process.execPath;
const entry=path.join(productRoot,"app","task-invocation.js");
const agentLoopPath=path.join(productRoot,"app","agent-loop.js");
const source=fs.readFileSync(entry,"utf8");
const invocation=require(entry);

function validInvocation(task="Open UTF-8 exactly"){
  return {
    version:1,
    task,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:"/var/tmp/p9b-lifecycle/current.js",
    }],
  };
}

function makePreload(tmp){
  const preload=path.join(tmp,"preload.js");
  fs.writeFileSync(preload,`"use strict";\nconst fs=require("node:fs");\nconst agentPath=process.env.P9B_LIFECYCLE_AGENT_LOOP_PATH;\nconst capturePath=process.env.P9B_LIFECYCLE_CAPTURE_PATH;\nconst mode=process.env.P9B_LIFECYCLE_MODE||"ok";\nconst resolved=require.resolve(agentPath);\nlet runTaskCalls=0;\nlet cleanupCalls=0;\nlet activeHandle=setInterval(()=>{},1000);\nfunction writeCapture(){fs.writeFileSync(capturePath,JSON.stringify({runTaskCalls,cleanupCalls,activeHandle:Boolean(activeHandle)}),"utf8");}\nrequire.cache[resolved]={id:resolved,filename:resolved,loaded:true,exports:{\n  runTask:async()=>{runTaskCalls++;writeCapture();if(mode==="throw")throw new Error("P9B_LIFECYCLE_STUB_THROW");if(mode==="fail")return {ok:false,error:"P9B_LIFECYCLE_STUB_FAILURE"};return {ok:true,state:{currentApp:"Pulsar"},intentResults:[]};},\n  cleanupComputerControl:()=>{cleanupCalls++;if(activeHandle){clearInterval(activeHandle);activeHandle=null;}writeCapture();}\n}};\n`);
  return preload;
}

function spawnEntry(mode){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-lifecycle-"));
  const preload=makePreload(tmp);
  const capture=path.join(tmp,"capture.json");
  const child=spawnSync(node,["-r",preload,entry],{
    input:`${JSON.stringify(validInvocation())}\n`,
    encoding:"utf8",
    timeout:5000,
    maxBuffer:8*1024*1024,
    env:{
      ...process.env,
      P9B_LIFECYCLE_AGENT_LOOP_PATH:agentLoopPath,
      P9B_LIFECYCLE_CAPTURE_PATH:capture,
      P9B_LIFECYCLE_MODE:mode,
    },
  });
  let observed=null;
  if(fs.existsSync(capture))observed=JSON.parse(fs.readFileSync(capture,"utf8"));
  fs.rmSync(tmp,{recursive:true,force:true});
  return {child,observed};
}

test("P9B executable task invocation closes its owned runtime exactly once after success",()=>{
  const {child,observed}=spawnEntry("ok");
  assert.equal(child.error,undefined,child.error?.message);
  assert.equal(child.signal,null);
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(observed,{runTaskCalls:1,cleanupCalls:1,activeHandle:false});
});

test("P9B executable task invocation closes its owned runtime exactly once after runTask failure",()=>{
  const {child,observed}=spawnEntry("fail");
  assert.equal(child.error,undefined,child.error?.message);
  assert.equal(child.signal,null);
  assert.equal(child.status,1);
  assert.match(String(child.stderr||""),/TASK_INVOCATION_FAILED/);
  assert.deepEqual(observed,{runTaskCalls:1,cleanupCalls:1,activeHandle:false});
});

test("P9B executable task invocation closes its owned runtime exactly once after runTask exception",()=>{
  const {child,observed}=spawnEntry("throw");
  assert.equal(child.error,undefined,child.error?.message);
  assert.equal(child.signal,null);
  assert.equal(child.status,1);
  assert.match(String(child.stderr||""),/TASK_INVOCATION_EXECUTION_EXCEPTION: P9B_LIFECYCLE_STUB_THROW/);
  assert.deepEqual(observed,{runTaskCalls:1,cleanupCalls:1,activeHandle:false});
});

test("P9B programmatic runTaskInvocation keeps reusable caller-owned lifecycle semantics",async()=>{
  let calls=0;
  const result=await invocation.runTaskInvocation(validInvocation(),{
    runTask:async()=>{calls++;return {ok:true,state:{currentApp:"Pulsar"},intentResults:[]};},
  });
  assert.equal(result.ok,true);
  assert.equal(calls,1);

  const runTaskStart=source.indexOf("async function runTaskInvocation");
  const stdinStart=source.indexOf("function readInvocationFromStdin");
  const runTaskSection=source.slice(runTaskStart,stdinStart);
  assert.doesNotMatch(runTaskSection,/cleanupComputerControl/);
});

test("P9B lifecycle ownership is executable-only and invalid envelopes still fail before agent-loop loading",()=>{
  const normalizeIndex=source.indexOf("const normalized=normalizeTaskInvocation(read.value)");
  const agentLoadIndex=source.indexOf('const agentLoop=require("./agent-loop")');
  assert.ok(normalizeIndex>=0);
  assert.ok(agentLoadIndex>normalizeIndex);
  assert.match(source,/finally\{\s*if\(typeof agentLoop\.cleanupComputerControl==="function"\)\{\s*agentLoop\.cleanupComputerControl\(\);/s);
  assert.doesNotMatch(source,/process\.exit\(0\)|process\.exit\(1\).*TASK_INVOCATION_COMPLETED/s);
});
