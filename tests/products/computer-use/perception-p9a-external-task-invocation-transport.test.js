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

function validInvocation(task="Open UTF-8 exactly"){
  return {
    version:1,
    task,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:"/var/tmp/p9a/current.js",
    }],
  };
}

function spawnEntry(input,{preload=null,capture=null,result="ok"}={}){
  const args=[];
  if(preload)args.push("-r",preload);
  args.push(entry);
  return spawnSync(node,args,{
    input,
    encoding:"utf8",
    maxBuffer:8*1024*1024,
    env:{
      ...process.env,
      ...(capture?{P9A_CAPTURE_PATH:capture}:{}),
      ...(preload?{P9A_AGENT_LOOP_PATH:agentLoopPath,P9A_RUN_RESULT:result}:{}),
    },
  });
}

function makePreload(tmp){
  const preload=path.join(tmp,"preload.js");
  fs.writeFileSync(preload,`"use strict";\nconst fs=require("node:fs");\nconst agentPath=process.env.P9A_AGENT_LOOP_PATH;\nconst capture=process.env.P9A_CAPTURE_PATH;\nconst resolved=require.resolve(agentPath);\nrequire.cache[resolved]={id:resolved,filename:resolved,loaded:true,exports:{runTask:async(task,options)=>{const payload={task,optionKeys:Object.keys(options||{}),taskResourceContext:options?.taskResourceContext||null};fs.writeFileSync(capture,JSON.stringify(payload),"utf8");return process.env.P9A_RUN_RESULT==="fail"?{ok:false,error:"P9A_STUB_FAILURE"}:{ok:true,state:{currentApp:"Pulsar"},intentResults:[]};}}};\n`);
  return preload;
}

test("P9A real stdin process accepts one valid invocation and forwards only taskResourceContext",()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9a-"));
  try{
    const preload=makePreload(tmp);
    const capture=path.join(tmp,"capture.json");
    const raw=validInvocation("  Open UTF-8 exactly  ");
    const child=spawnEntry(`${JSON.stringify(raw)}\n`,{preload,capture});
    assert.equal(child.status,0,child.stderr);
    assert.equal(child.signal,null);
    assert.equal(String(child.stderr||""),"");
    assert.equal(fs.existsSync(capture),true);
    const observed=JSON.parse(fs.readFileSync(capture,"utf8"));
    assert.equal(observed.task,raw.task);
    assert.deepEqual(observed.optionKeys,["taskResourceContext"]);
    assert.deepEqual(observed.taskResourceContext,{
      version:1,
      resources:[{
        kind:"file",
        role:"current-document",
        application:"Pulsar",
        path:"/var/tmp/p9a/current.js",
      }],
    });
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});

test("P9A process rejects empty, malformed and oversized stdin before runTask",()=>{
  const empty=spawnEntry("");
  assert.equal(empty.status,2);
  assert.match(String(empty.stderr||""),/TASK_INVOCATION_INPUT_EMPTY/);

  const malformed=spawnEntry("{not-json}\n");
  assert.equal(malformed.status,2);
  assert.match(String(malformed.stderr||""),/TASK_INVOCATION_JSON_INVALID/);

  const oversized=spawnEntry("x".repeat(1024*1024+1));
  assert.equal(oversized.status,2);
  assert.match(String(oversized.stderr||""),/TASK_INVOCATION_INPUT_TOO_LARGE/);
});

test("P9A process rejects hidden visual fields before agent-loop loading",()=>{
  const raw={...validInvocation(),visualFallbackContracts:[]};
  const child=spawnEntry(JSON.stringify(raw));
  assert.equal(child.status,1);
  assert.match(String(child.stderr||""),/TASK_INVOCATION_FIELD_UNSUPPORTED/);
  assert.doesNotMatch(String(child.stderr||""),/MODULE_NOT_FOUND|agent-loop/i);
});

test("P9A process propagates one failed runTask without retrying or changing provenance",()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9a-"));
  try{
    const preload=makePreload(tmp);
    const capture=path.join(tmp,"capture.json");
    const child=spawnEntry(JSON.stringify(validInvocation()),{preload,capture,result:"fail"});
    assert.equal(child.status,1);
    assert.match(String(child.stderr||""),/TASK_INVOCATION_FAILED/);
    const observed=JSON.parse(fs.readFileSync(capture,"utf8"));
    assert.deepEqual(observed.optionKeys,["taskResourceContext"]);
    assert.equal(observed.taskResourceContext.resources.length,1);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});

test("P9A executable transport is stdin-only and adds no product test hook",()=>{
  assert.match(source,/fs\.readFileSync\(0/);
  assert.match(source,/JSON\.parse\(input\)/);
  assert.match(source,/if\(require\.main===module\)/);
  assert.match(source,/main\(\)\.catch/);
  assert.doesNotMatch(source,/P9A_|NODE_OPTIONS|preload|mock|stub|testHook|validateOnly/i);
  assert.doesNotMatch(source,/visualFallbackContracts|visualFallbackCallerContext|documentPath|surfacePrecondition|providerRequest/);
});
