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
  console.error(`physical-computer-use-perception-p9b-diagnostic=FAIL code=${code}${detail?` detail=${detail}`:""}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-diagnostic=BLOCKED code=MACOS_REQUIRED");
  process.exit(2);
}
if(!fs.existsSync(baseSource))fail("BASE_SOURCE_MISSING");

const blob=spawnSync("/usr/bin/git",["hash-object",baseSource],{encoding:"utf8"});
if((blob.status??1)!==0)fail("BASE_SOURCE_HASH_FAILED");
if(String(blob.stdout||"").trim()!==expectedBaseBlob)fail("BASE_SOURCE_CHANGED");

let source=fs.readFileSync(baseSource,"utf8");
const captureAnchor="      taskOk:result?.ok===true,\n      openedVisual:opened?{";
if(!source.includes(captureAnchor))fail("CAPTURE_PATCH_ANCHOR_MISSING");
source=source.replace(
  captureAnchor,
  `      taskOk:result?.ok===true,\n      taskError:result?.error||null,\n      intentSummaries:Array.isArray(result?.intentResults)?result.intentResults.map(item=>({ok:item?.ok===true,error:item?.error||null,code:item?.code||item?.visualFallbackEligibility?.code||null,executionPath:item?.executionPath||null,deliveryState:item?.delivery?.state||null,controlState:item?.delivery?.controlState||null,taskOutcomeState:item?.taskOutcome?.state||null})):[],\n      openedVisual:opened?{`
);

const childAnchor=`    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");\n    if((child.status??1)!==0)fail("P9B_CHILD_PROCESS_FAILED");\n    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");\n    if(!fs.existsSync(capturePath))fail("P9B_CHILD_CAPTURE_MISSING");\n\n    let capture;\n    try{capture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{fail("P9B_CHILD_CAPTURE_INVALID");}`;
if(!source.includes(childAnchor))fail("CHILD_PATCH_ANCHOR_MISSING");
source=source.replace(childAnchor,`    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");\n    let capture=null;\n    if(fs.existsSync(capturePath)){\n      try{capture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{}\n    }\n    if((child.status??1)!==0){\n      const redact=value=>String(value??"").replaceAll(String(tmp||""),"<TMP>").replaceAll(String(productRoot||""),"<PRODUCT_ROOT>").slice(0,512);\n      const diagnostic={\n        childStatus:child.status??null,\n        childStderr:redact(String(child.stderr||"").trim()),\n        capturePresent:capture!==null,\n        realAgentLoop:capture?.realAgentLoop===true,\n        runTaskCalls:capture?.runTaskCalls??null,\n        inputOptionKeys:capture?.inputOptionKeys||null,\n        sourcePreflight:capture?.sourcePreflight||null,\n        verifyCalls:capture?.verifyCalls??null,\n        providerSelectCalls:capture?.providerSelectCalls??null,\n        windowObserveCalls:capture?.windowObserveCalls??null,\n        lastSurface:capture?.lastSurface||null,\n        taskOk:capture?.taskOk===true,\n        taskError:capture?.taskError?redact(capture.taskError):null,\n        intentSummaries:Array.isArray(capture?.intentSummaries)?capture.intentSummaries.map(item=>({...item,error:item?.error?redact(item.error):null})):[],\n        openedVisual:capture?.openedVisual||null,\n        thrown:capture?.thrown?{name:redact(capture.thrown.name),message:redact(capture.thrown.message)}:null,\n      };\n      console.log("p9b-child-diagnostic="+JSON.stringify(diagnostic));\n      fail("P9B_CHILD_PROCESS_FAILED");\n    }\n    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");\n    if(!capture)fail("P9B_CHILD_CAPTURE_MISSING");`);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-diagnostic-"));
const patched=path.join(tmp,"p9b-diagnostic-run.js");
fs.writeFileSync(patched,source,"utf8");

let child;
try{
  child=spawnSync(NODE,[patched],{
    encoding:"utf8",
    maxBuffer:16*1024*1024,
    env:{...process.env},
  });
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}

const stdout=String(child.stdout||"");
const stderr=String(child.stderr||"");
const diagnosticLine=stdout.split(/\r?\n/).find(line=>line.startsWith("p9b-child-diagnostic="))||null;
const cleanupLine=stdout.split(/\r?\n/).find(line=>line.startsWith("p9b-test-cleanup="))||null;
const physicalLine=stdout.split(/\r?\n/).find(line=>line.startsWith("physical-computer-use-perception-p9b="))||null;

if((child.status??1)===2){
  console.log(`p9b-diagnostic=BLOCKED childStatus=2 physicalMarker=${physicalLine||"missing"}`);
  console.log("physical-computer-use-perception-p9b-diagnostic=BLOCKED code=BASE_PHYSICAL_BLOCKED");
  process.exit(2);
}
if(cleanupLine&&!cleanupLine.startsWith("p9b-test-cleanup=PASS"))fail("BASE_CLEANUP_FAILED");

if((child.status??1)===0){
  console.log("p9b-diagnostic=PASS childFailureReproduced=false physicalPathPassedUnderDiagnosticPatch=true");
  console.log(`p9b-diagnostic-cleanup=${cleanupLine||"missing"}`);
  console.log("physical-computer-use-perception-p9b-diagnostic=PASS");
  process.exit(0);
}

if((child.status??1)!==1)fail("BASE_CHILD_STATUS_UNEXPECTED",String(child.status));
if(!diagnosticLine)fail("DIAGNOSTIC_CAPTURE_MISSING");
if(!physicalLine?.includes("code=P9B_CHILD_PROCESS_FAILED"))fail("FAILURE_CLASS_CHANGED");
if(stderr.trim()){
  const safe=stderr.trim().replace(/\s+/g," ").slice(0,256);
  console.log(`p9b-diagnostic-wrapper-stderr=${JSON.stringify(safe)}`);
}

let diagnostic;
try{diagnostic=JSON.parse(diagnosticLine.slice("p9b-child-diagnostic=".length));}
catch{fail("DIAGNOSTIC_JSON_INVALID");}

console.log("p9b-diagnostic=PASS childFailureReproduced=true failureClass=P9B_CHILD_PROCESS_FAILED");
console.log(`p9b-diagnostic-detail=${JSON.stringify(diagnostic)}`);
console.log(`p9b-diagnostic-cleanup=${cleanupLine||"missing"}`);
console.log("physical-computer-use-perception-p9b-diagnostic=PASS");
