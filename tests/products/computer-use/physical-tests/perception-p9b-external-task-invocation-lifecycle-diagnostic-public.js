#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const baseSource=path.join(__dirname,"perception-p9b-pulsar-external-task-invocation-public.js");
const expectedBaseBlob="9d794aaf8e61018c8d7f71b2e5dba3ebfbbf7950";

function fail(code,detail=""){
  console.log(`physical-computer-use-perception-p9b-lifecycle-diagnostic=FAIL code=${code}${detail?` detail=${detail}`:""}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-lifecycle-diagnostic=BLOCKED code=MACOS_REQUIRED");
  process.exit(2);
}
if(!fs.existsSync(baseSource))fail("BASE_SOURCE_MISSING");

const blob=spawnSync("/usr/bin/git",["hash-object",baseSource],{encoding:"utf8"});
if((blob.status??1)!==0)fail("BASE_SOURCE_HASH_FAILED");
if(String(blob.stdout||"").trim()!==expectedBaseBlob)fail("BASE_SOURCE_CHANGED");

let source=fs.readFileSync(baseSource,"utf8");

const broken='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\n","utf8");';
const fixed='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\\\n","utf8");';
if(source.split(broken).length-1!==1)fail("PRELOAD_ESCAPE_PATCH_ANCHOR_INVALID");
source=source.replace(broken,fixed);

const childOptionsAnchor='      env:{...process.env,P9B_PRODUCT_ROOT:productRoot,P9B_CAPTURE_PATH:capturePath},\n    });';
const childOptionsReplacement='      env:{...process.env,P9B_PRODUCT_ROOT:productRoot,P9B_CAPTURE_PATH:capturePath},\n      timeout:45000,\n      killSignal:"SIGTERM",\n    });';
if(source.split(childOptionsAnchor).length-1!==1)fail("CHILD_TIMEOUT_PATCH_ANCHOR_INVALID");
source=source.replace(childOptionsAnchor,childOptionsReplacement);

const statusAnchor='    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");\n    if((child.status??1)!==0)fail("P9B_CHILD_PROCESS_FAILED");\n    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");\n    if(!fs.existsSync(capturePath))fail("P9B_CHILD_CAPTURE_MISSING");\n\n    let capture;\n    try{capture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{fail("P9B_CHILD_CAPTURE_INVALID");}';
const statusReplacement='    let capture=null;\n    if(fs.existsSync(capturePath)){\n      try{capture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{}\n    }\n    const timedOut=child.error?.code==="ETIMEDOUT";\n    if(timedOut){\n      const opened=capture?.openedVisual||null;\n      const diagnostic={\n        childTimedOut:true,\n        childSignal:child.signal||null,\n        capturePresent:capture!==null,\n        realAgentLoop:capture?.realAgentLoop===true,\n        runTaskCalls:capture?.runTaskCalls??null,\n        inputOptionKeys:capture?.inputOptionKeys||null,\n        sourcePreflight:capture?.sourcePreflight||null,\n        verifyCalls:capture?.verifyCalls??null,\n        providerSelectCalls:capture?.providerSelectCalls??null,\n        windowObserveCalls:capture?.windowObserveCalls??null,\n        lastSurface:capture?.lastSurface||null,\n        taskOk:capture?.taskOk===true,\n        openedVisual:opened,\n        thrown:capture?.thrown||null,\n      };\n      console.log("p9b-child-lifecycle-diagnostic="+JSON.stringify(diagnostic));\n      const verifiedSuccess=capture?.taskOk===true&&opened?.taskOutcomeState==="VERIFIED_SUCCESS"&&opened?.taskOutcomeBasis==="post-action-independent-observation";\n      const classification=verifiedSuccess\n        ?"TASK_COMPLETED_PROCESS_DID_NOT_EXIT"\n        :(capture?"CHILD_TIMEOUT_WITH_CAPTURE_BEFORE_VERIFIED_SUCCESS":"CHILD_TIMEOUT_WITHOUT_CAPTURE");\n      console.log(`p9b-lifecycle-classification=${classification}`);\n      outcome={code:0,marker:`physical-computer-use-perception-p9b-lifecycle-diagnostic=PASS classification=${classification}`};\n      return;\n    }\n    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");\n    if((child.status??1)!==0)fail("P9B_CHILD_PROCESS_FAILED");\n    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");\n    if(!capture)fail("P9B_CHILD_CAPTURE_MISSING");';
if(source.split(statusAnchor).length-1!==1)fail("CHILD_STATUS_PATCH_ANCHOR_INVALID");
source=source.replace(statusAnchor,statusReplacement);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-lifecycle-diagnostic-"));
const patched=path.join(tmp,"p9b-lifecycle-diagnostic-run.js");
fs.writeFileSync(patched,source,"utf8");

let child;
try{
  const syntax=spawnSync(NODE,["--check",patched],{encoding:"utf8",maxBuffer:4*1024*1024,env:{...process.env}});
  if((syntax.status??1)!==0){
    if(syntax.stderr)process.stderr.write(syntax.stderr);
    fail("PATCHED_SOURCE_SYNTAX_INVALID");
  }

  child=spawnSync(NODE,[patched],{
    encoding:"utf8",
    maxBuffer:16*1024*1024,
    timeout:75000,
    killSignal:"SIGTERM",
    env:{...process.env},
  });
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}

if(child.stdout)process.stdout.write(child.stdout);
if(child.stderr)process.stderr.write(child.stderr);

if(child.error?.code==="ETIMEDOUT")fail("DIAGNOSTIC_WRAPPER_TIMEOUT");
if((child.status??1)===2){
  console.log("physical-computer-use-perception-p9b-lifecycle-diagnostic=BLOCKED code=BASE_PHYSICAL_BLOCKED");
  process.exit(2);
}
if((child.status??1)!==0)fail("DIAGNOSTIC_PATCHED_PHYSICAL_FAILED",String(child.status));

const stdout=String(child.stdout||"");
const detail=stdout.split(/\r?\n/).find(line=>line.startsWith("p9b-child-lifecycle-diagnostic="))||null;
const classification=stdout.split(/\r?\n/).find(line=>line.startsWith("p9b-lifecycle-classification="))||null;
const cleanup=stdout.split(/\r?\n/).find(line=>line.startsWith("p9b-test-cleanup="))||null;
const marker=stdout.split(/\r?\n/).find(line=>line.startsWith("physical-computer-use-perception-p9b-lifecycle-diagnostic=PASS"))||null;

if(!detail||!classification||!marker)fail("LIFECYCLE_DIAGNOSTIC_MARKERS_MISSING");
if(!cleanup?.startsWith("p9b-test-cleanup=PASS"))fail("BASE_CLEANUP_FAILED");

console.log("p9b-lifecycle-diagnostic=PASS childTimeoutBounded=true captureClassified=true productChanged=false");
console.log("physical-computer-use-perception-p9b-lifecycle-diagnostic-wrapper=PASS");
