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
  console.log(`physical-computer-use-perception-p9b-s15=FAIL code=${code}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-s15=BLOCKED code=MACOS_REQUIRED");
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

const deliveryBasedSelectorCleanup=`    if(computerControl&&pulsarLaunched&&childAttempted){
      try{const dismissed=computerControl.press({app:"Pulsar",keys:"Escape",settle:false});selectorDismissed=dismissed?.ok!==false;}catch{selectorDismissed=false;}
    }else selectorDismissed=true;

`;
if(source.split(deliveryBasedSelectorCleanup).length-1!==1)fail("SELECTOR_DELIVERY_CLEANUP_PATCH_ANCHOR_INVALID");
source=source.replace(deliveryBasedSelectorCleanup,"");

const terminationCleanup=`    if(computerControl&&pulsarLaunched){
      try{const result=computerControl.terminateApplication({app:"Pulsar",timeoutMs:10000});pulsarCleanup=result?.ok===true;}catch{pulsarCleanup=false;}
    }else pulsarCleanup=!pulsarLaunched;
`;
const verifiedAbsenceCleanup=`    if(computerControl&&pulsarLaunched){
      try{
        const result=computerControl.terminateApplication({app:"Pulsar",timeoutMs:10000});
        pulsarCleanup=result?.ok===true&&!pulsarRunning();
        selectorDismissed=pulsarCleanup;
      }catch{
        pulsarCleanup=false;
        selectorDismissed=false;
      }
    }else{
      pulsarCleanup=!pulsarLaunched;
      selectorDismissed=pulsarCleanup;
    }
`;
if(source.split(terminationCleanup).length-1!==1)fail("TERMINATION_CLEANUP_PATCH_ANCHOR_INVALID");
source=source.replace(terminationCleanup,verifiedAbsenceCleanup);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-s15-"));
const patched=path.join(tmp,"p9b-s15-physical.js");
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

  if(child.stdout)process.stdout.write(child.stdout);
  if(child.stderr)process.stderr.write(child.stderr);

  if((child.status??1)===0){
    console.log("p9b-s15-fixture-correction=PASS baseBlobVerified=true generatedPreloadNewlineEscape=true distinctComputerControlSockets=true selectorCleanupDeliveryAssumptionRemoved=true selectorAbsenceBasis=verified-application-termination processAbsenceChecked=true productChanged=false");
    console.log("physical-computer-use-perception-p9b-s15=PASS");
    process.exit(0);
  }
  if((child.status??1)===2){
    console.log("physical-computer-use-perception-p9b-s15=BLOCKED code=PATCHED_PHYSICAL_BLOCKED");
    process.exit(2);
  }
  console.log(`physical-computer-use-perception-p9b-s15=FAIL code=PATCHED_PHYSICAL_FAILED childStatus=${child.status??"null"} childSignal=${child.signal??"none"}`);
  process.exit(1);
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}
