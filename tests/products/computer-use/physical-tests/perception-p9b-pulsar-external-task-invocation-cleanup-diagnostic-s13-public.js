#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const baseSource=path.join(__dirname,"perception-p9b-pulsar-external-task-invocation-s11-public.js");
const nestedBaseSource=path.join(__dirname,"perception-p9b-pulsar-external-task-invocation-public.js");
const expectedBaseBlob="c731f1d693fa823cd17a43b5270d6ec7cb7373a4";
const expectedNestedBaseBlob="9d794aaf8e61018c8d7f71b2e5dba3ebfbbf7950";

function fail(code){
  console.log(`physical-computer-use-perception-p9b-s13=FAIL code=${code}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-s13=BLOCKED code=MACOS_REQUIRED");
  process.exit(2);
}
if(!fs.existsSync(baseSource))fail("S11_SOURCE_MISSING");
if(!fs.existsSync(nestedBaseSource))fail("P9B_BASE_SOURCE_MISSING");

const blob=spawnSync("/usr/bin/git",["hash-object",baseSource],{encoding:"utf8"});
if((blob.status??1)!==0)fail("S11_SOURCE_HASH_FAILED");
if(String(blob.stdout||"").trim()!==expectedBaseBlob)fail("S11_SOURCE_CHANGED");
const nestedBlob=spawnSync("/usr/bin/git",["hash-object",nestedBaseSource],{encoding:"utf8"});
if((nestedBlob.status??1)!==0)fail("P9B_BASE_SOURCE_HASH_FAILED");
if(String(nestedBlob.stdout||"").trim()!==expectedNestedBaseBlob)fail("P9B_BASE_SOURCE_CHANGED");

let source=fs.readFileSync(baseSource,"utf8");
const original='const foregroundSemanticCleanup=\'const cleanupForeground=computerControl.activateApplication({app:"Pulsar",timeoutMs:5000});const dismissed=cleanupForeground?.ok===true?computerControl.press({app:"Pulsar",keys:"Escape",settle:false}):{ok:false,state:"SKIPPED",error:"FOREGROUND_REASSERT_FAILED"};selectorDismissed=dismissed?.ok!==false;\';';
const diagnostic='const foregroundSemanticCleanup=\'const cleanupForeground=computerControl.activateApplication({app:"Pulsar",timeoutMs:5000});let dismissed=null;let cleanupPressThrown=null;try{dismissed=cleanupForeground?.ok===true?computerControl.press({app:"Pulsar",keys:"Escape",settle:false}):{ok:false,state:"SKIPPED",error:"FOREGROUND_REASSERT_FAILED"};}catch(error){cleanupPressThrown={name:error?.name||"Error",code:error?.code||null,message:String(error?.message||error||"PRESS_THROWN")};dismissed={ok:false,state:"THREW",error:cleanupPressThrown.code||cleanupPressThrown.name};}selectorDismissed=dismissed?.ok!==false;console.log(`p9b-s13-cleanup-detail=OBSERVED activateOk=${cleanupForeground?.ok===true} activateState=${cleanupForeground?.state||"none"} pressOk=${dismissed?.ok===true} pressState=${dismissed?.state||"none"} pressError=${dismissed?.error||"none"} pressThrown=${cleanupPressThrown!==null} thrownName=${cleanupPressThrown?.name||"none"} thrownCode=${cleanupPressThrown?.code||"none"} thrownMessage=${cleanupPressThrown?cleanupPressThrown.message.replace(/\\s+/g,"_").slice(0,160):"none"}`);\';';
if(source.split(original).length-1!==1)fail("S11_CLEANUP_PATCH_ANCHOR_INVALID");
source=source.replace(original,diagnostic);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-s13-"));
const patched=path.join(tmp,"p9b-s13-physical.js");
const tempNestedBase=path.join(tmp,path.basename(nestedBaseSource));
fs.copyFileSync(nestedBaseSource,tempNestedBase);
fs.writeFileSync(patched,source,"utf8");

try{
  const copiedBlob=spawnSync("/usr/bin/git",["hash-object",tempNestedBase],{encoding:"utf8"});
  if((copiedBlob.status??1)!==0)fail("TEMP_BASE_SOURCE_HASH_FAILED");
  if(String(copiedBlob.stdout||"").trim()!==expectedNestedBaseBlob)fail("TEMP_BASE_SOURCE_CHANGED");

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
    console.log("physical-computer-use-perception-p9b-s13=BLOCKED code=PATCHED_PHYSICAL_BLOCKED");
    process.exit(2);
  }

  const detailObserved=stdout.includes("p9b-s13-cleanup-detail=OBSERVED");
  const coreVerified=
    stdout.includes("p9b-external-process=PASS")&&
    stdout.includes("p9b-provenance-chain=PASS")&&
    stdout.includes("p9b-semantic-first=PASS")&&
    stdout.includes("p9b-surface=PASS")&&
    stdout.includes("p9b-provider=PASS")&&
    stdout.includes("p9b-postcondition=PASS")&&
    stdout.includes("p9b-delivery-success-separation=PASS")&&
    stdout.includes("p9b-document-integrity=PASS")&&
    stdout.includes("taskOutcome=VERIFIED_SUCCESS");

  if(!detailObserved)fail("SEMANTIC_CLEANUP_DIAGNOSTIC_NOT_OBSERVED");
  if(!coreVerified)fail("CORE_P9B_PATH_NOT_VERIFIED");

  console.log(`p9b-s13-diagnostic=PASS classification=SEMANTIC_CLEANUP_DETAIL_OBSERVED childStatus=${child.status??"null"} childSignal=${child.signal??"none"} corePathVerified=true nestedBasePreserved=true productChanged=false`);
  console.log("physical-computer-use-perception-p9b-s13=PASS");
  process.exit(0);
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}
