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
  console.log(`physical-computer-use-perception-p9b-s06=FAIL code=${code}`);
  process.exit(1);
}

if(process.platform!=="darwin"){
  console.log("physical-computer-use-perception-p9b-s06=BLOCKED code=MACOS_REQUIRED");
  process.exit(2);
}
if(!fs.existsSync(baseSource))fail("BASE_SOURCE_MISSING");

const blob=spawnSync("/usr/bin/git",["hash-object",baseSource],{encoding:"utf8"});
if((blob.status??1)!==0)fail("BASE_SOURCE_HASH_FAILED");
if(String(blob.stdout||"").trim()!==expectedBaseBlob)fail("BASE_SOURCE_CHANGED");

let source=fs.readFileSync(baseSource,"utf8");
const broken='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\n","utf8");';
const fixed='fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\\\\n","utf8");';
const occurrences=source.split(broken).length-1;
if(occurrences!==1)fail("PRELOAD_ESCAPE_PATCH_ANCHOR_INVALID");
source=source.replace(broken,fixed);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-s06-"));
const patched=path.join(tmp,"p9b-s06-physical.js");
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
    env:{...process.env},
  });

  if(child.stdout)process.stdout.write(child.stdout);
  if(child.stderr)process.stderr.write(child.stderr);

  if((child.status??1)===0){
    console.log("p9b-s06-fixture-correction=PASS baseBlobVerified=true correction=generated-preload-newline-escape-only lifecycleFixProduct=true");
    console.log("physical-computer-use-perception-p9b-s06=PASS");
    process.exit(0);
  }
  if((child.status??1)===2){
    console.log("physical-computer-use-perception-p9b-s06=BLOCKED code=PATCHED_PHYSICAL_BLOCKED");
    process.exit(2);
  }
  console.log(`physical-computer-use-perception-p9b-s06=FAIL code=PATCHED_PHYSICAL_FAILED childStatus=${child.status??"null"}`);
  process.exit(1);
}finally{
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}
