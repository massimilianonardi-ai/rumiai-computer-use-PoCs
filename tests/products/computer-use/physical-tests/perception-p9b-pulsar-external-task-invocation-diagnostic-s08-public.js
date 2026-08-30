#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const baseSource=path.join(__dirname,"perception-p9b-pulsar-external-task-invocation-public.js");
const expectedBaseBlob="9d794aaf8e61018c8d7f71b2e5dba3ebfbbf7950";

function fail(code){
  console.log(`physical-computer-use-perception-p9b-s08-diagnostic=FAIL code=${code}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-s08-diagnostic=BLOCKED code=MACOS_REQUIRED");
  process.exit(2);
}
if(!fs.existsSync(baseSource))fail("BASE_SOURCE_MISSING");

const blob=spawnSync("/usr/bin/git",["hash-object",baseSource],{encoding:"utf8"});
if((blob.status??1)!==0)fail("BASE_SOURCE_HASH_FAILED");
if(String(blob.stdout||"").trim()!==expectedBaseBlob)fail("BASE_SOURCE_CHANGED");

let source=fs.readFileSync(baseSource,"utf8");

const brokenEscape='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\n","utf8");';
const fixedEscape='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\\\n","utf8");';
if(source.split(brokenEscape).length-1!==1)fail("PRELOAD_ESCAPE_PATCH_ANCHOR_INVALID");
source=source.replace(brokenEscape,fixedEscape);

const sharedSocket='env:{...process.env,P9B_PRODUCT_ROOT:productRoot,P9B_CAPTURE_PATH:capturePath},';
const distinctSocket='env:{...process.env,RUMIAI_CC_SOCKET:path.join(tmp,"child-cc.sock"),P9B_PRODUCT_ROOT:productRoot,P9B_CAPTURE_PATH:capturePath},';
if(source.split(sharedSocket).length-1!==1)fail("CHILD_SOCKET_PATCH_ANCHOR_INVALID");
source=source.replace(sharedSocket,distinctSocket);

const opaqueFailure=`    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");
    if((child.status??1)!==0)fail("P9B_CHILD_PROCESS_FAILED");
    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");
    if(!fs.existsSync(capturePath))fail("P9B_CHILD_CAPTURE_MISSING");`;
const diagnosticFailure=`    if(child.signal!==null||(child.status??1)!==0||String(child.stderr||"").trim()){
      let diagnosticCapture=null;
      if(fs.existsSync(capturePath)){
        try{diagnosticCapture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{}
      }
      const stderrText=String(child.stderr||"").trim();
      const taskException=(stderrText.match(/TASK_INVOCATION_EXECUTION_EXCEPTION:\\s*([^\\n]+)/)||[])[1]||null;
      const invocationFailure=/TASK_INVOCATION_FAILED/.test(stderrText);
      const classification=diagnosticCapture?.thrown?.message
        ? "RUN_TASK_THROWN"
        : diagnosticCapture?.taskOk===false
          ? "RUN_TASK_RETURNED_FAILURE"
          : taskException
            ? "TASK_INVOCATION_EXECUTION_EXCEPTION"
            : invocationFailure
              ? "TASK_INVOCATION_FAILED_WITHOUT_CAPTURE_RESULT"
              : diagnosticCapture
                ? "CHILD_FAILED_WITH_CAPTURE"
                : "CHILD_FAILED_WITHOUT_CAPTURE";
      const detail={
        childStatus:child.status??null,
        childSignal:child.signal??null,
        stderrClass:taskException?"TASK_INVOCATION_EXECUTION_EXCEPTION":(invocationFailure?"TASK_INVOCATION_FAILED":(stderrText?"OTHER_STDERR":"NONE")),
        taskException:taskException?taskException.slice(0,300):null,
        capturePresent:diagnosticCapture!==null,
        realAgentLoop:diagnosticCapture?.realAgentLoop===true,
        runTaskCalls:diagnosticCapture?.runTaskCalls??null,
        inputOptionKeys:Array.isArray(diagnosticCapture?.inputOptionKeys)?diagnosticCapture.inputOptionKeys:null,
        sourcePreflight:diagnosticCapture?.sourcePreflight||null,
        verifyCalls:diagnosticCapture?.verifyCalls??null,
        providerSelectCalls:diagnosticCapture?.providerSelectCalls??null,
        windowObserveCalls:diagnosticCapture?.windowObserveCalls??null,
        lastSurface:diagnosticCapture?.lastSurface||null,
        taskOk:diagnosticCapture?.taskOk??null,
        openedVisual:diagnosticCapture?.openedVisual||null,
        thrown:diagnosticCapture?.thrown?{name:diagnosticCapture.thrown.name||null,message:String(diagnosticCapture.thrown.message||"").slice(0,300)}:null,
      };
      console.log("p9b-s08-child-diagnostic="+JSON.stringify(detail));
      console.log("p9b-s08-classification="+classification);
      outcome={code:0,marker:"physical-computer-use-perception-p9b-s08-diagnostic=PASS classification="+classification};
      return;
    }
    if(!fs.existsSync(capturePath))fail("P9B_CHILD_CAPTURE_MISSING");`;
if(source.split(opaqueFailure).length-1!==1)fail("CHILD_FAILURE_PATCH_ANCHOR_INVALID");
source=source.replace(opaqueFailure,diagnosticFailure);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-s08-"));
const patched=path.join(tmp,"p9b-s08-diagnostic.js");
fs.writeFileSync(patched,source,"utf8");

let child;
try{
  const syntax=spawnSync(NODE,["--check",patched],{
    encoding:"utf8",
    maxBuffer:4*1024*1024,
    env:{...process.env},
  });
  if((syntax.status??1)!==0){
    if(syntax.stderr)process.stderr.write(syntax.stderr);
    fail("PATCHED_SOURCE_SYNTAX_INVALID");
  }

  child=spawnSync(NODE,[patched],{
    encoding:"utf8",
    maxBuffer:16*1024*1024,
    env:{...process.env},
  });

  if(child.stdout)process.stdout.write(child.stdout);
  if(child.stderr)process.stderr.write(child.stderr);

  if((child.status??1)===0&&/p9b-s08-classification=/.test(String(child.stdout||""))){
    console.log("p9b-s08-diagnostic=PASS baseBlobVerified=true generatedPreloadNewlineEscape=true distinctComputerControlSockets=true boundedChildFailureCapture=true productChanged=false");
    console.log("physical-computer-use-perception-p9b-s08-diagnostic-wrapper=PASS");
    process.exit(0);
  }
  if((child.status??1)===2){
    console.log("physical-computer-use-perception-p9b-s08-diagnostic-wrapper=BLOCKED code=PATCHED_PHYSICAL_BLOCKED");
    process.exit(2);
  }
  console.log(`physical-computer-use-perception-p9b-s08-diagnostic-wrapper=FAIL code=DIAGNOSTIC_NOT_OBSERVED childStatus=${child.status??"null"} childSignal=${child.signal??"none"}`);
  process.exit(1);
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}
