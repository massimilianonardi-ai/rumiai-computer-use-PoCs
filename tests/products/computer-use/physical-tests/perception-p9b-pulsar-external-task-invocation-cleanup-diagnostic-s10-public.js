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
  console.log(`physical-computer-use-perception-p9b-s10=FAIL code=${code}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-s10=BLOCKED code=MACOS_REQUIRED");
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

const semanticCleanup='const dismissed=computerControl.press({app:"Pulsar",keys:"Escape",settle:false});selectorDismissed=dismissed?.ok!==false;';
const diagnosticCleanup='const cleanupForeground=computerControl.activateApplication({app:"Pulsar",timeoutMs:5000});const cleanupObservedForeground=computerControl.getForeground();const dismissed=cleanupForeground?.ok===true?computerControl.pressKey({key:"Escape"}):{ok:false,state:"SKIPPED",error:"FOREGROUND_REASSERT_FAILED"};selectorDismissed=dismissed?.ok!==false;console.log(`p9b-s10-cleanup-detail=OBSERVED activateOk=${cleanupForeground?.ok===true} activateState=${cleanupForeground?.state||"none"} activateError=${cleanupForeground?.error||"none"} foregroundOk=${cleanupObservedForeground?.ok===true} foregroundName=${cleanupObservedForeground?.name||"none"} pressOk=${dismissed?.ok===true} pressState=${dismissed?.state||"none"} pressError=${dismissed?.error||"none"}`);';
if(source.split(semanticCleanup).length-1!==1)fail("SELECTOR_CLEANUP_PATCH_ANCHOR_INVALID");
source=source.replace(semanticCleanup,diagnosticCleanup);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-s10-"));
const patched=path.join(tmp,"p9b-s10-physical.js");
fs.writeFileSync(patched,source,"utf8");

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

  const child=spawnSync(NODE,[patched],{
    encoding:"utf8",
    maxBuffer:16*1024*1024,
    env:{...process.env},
  });
  const stdout=String(child.stdout||"");
  const stderr=String(child.stderr||"");
  if(stdout)process.stdout.write(stdout);
  if(stderr)process.stderr.write(stderr);

  if((child.status??1)===2){
    console.log("physical-computer-use-perception-p9b-s10=BLOCKED code=PATCHED_PHYSICAL_BLOCKED");
    process.exit(2);
  }

  const detailObserved=stdout.includes("p9b-s10-cleanup-detail=OBSERVED");
  const coreVerified=
    stdout.includes("p9b-external-process=PASS")&&
    stdout.includes("p9b-provenance-chain=PASS")&&
    stdout.includes("p9b-semantic-first=PASS")&&
    stdout.includes("p9b-provider=PASS")&&
    stdout.includes("p9b-postcondition=PASS")&&
    stdout.includes("p9b-delivery-success-separation=PASS")&&
    stdout.includes("p9b-document-integrity=PASS");

  if(!detailObserved)fail("CLEANUP_DIAGNOSTIC_NOT_OBSERVED");
  if(!coreVerified)fail("CORE_P9B_PATH_NOT_VERIFIED");

  console.log(`p9b-s10-diagnostic=PASS classification=CLEANUP_DETAIL_OBSERVED childStatus=${child.status??"null"} childSignal=${child.signal??"none"} corePathVerified=true productChanged=false`);
  console.log("physical-computer-use-perception-p9b-s10=PASS");
  process.exit(0);
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}
