"use strict";
const cp=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

if(process.platform!=="darwin"){
  console.log("physical-phase9d2c-clipboard-restoration-discovery=BLOCKED reason=macos-required");
  process.exit(2);
}

const helper=path.join(__dirname,"helpers/macos-clipboard-restoration-oracle.swift");
const binary=path.join(os.tmpdir(),`rumiai-clipboard-restoration-oracle-${process.pid}`);
function blocked(reason){console.log(`physical-phase9d2c-clipboard-restoration-discovery=BLOCKED reason=${reason}`);process.exit(2);}
function failed(reason){console.log(`physical-phase9d2c-clipboard-restoration-discovery=FAIL reason=${reason}`);process.exit(1);}

if(!fs.existsSync(helper))blocked("oracle-missing");
const compile=cp.spawnSync("/usr/bin/xcrun",["swiftc",helper,"-o",binary,"-framework","AppKit"],{encoding:"utf8",maxBuffer:8*1024*1024});
if((compile.status??1)!==0)blocked("oracle-compile-failed");
try{
  const run=cp.spawnSync(binary,[],{encoding:"utf8",maxBuffer:8*1024*1024});
  let value;
  try{value=JSON.parse(String(run.stdout||"").trim());}catch{failed("oracle-invalid-json");}
  if((run.status??1)===2||value?.state==="BLOCKED")blocked(value?.error||"backup-unavailable");
  if((run.status??1)!==0||value?.ok!==true)failed(value?.error||"restoration-failed");
  if(value.method!=="independent-nspasteboard-general-restoration-discovery")failed("oracle-method-mismatch");
  if(value.mutated!==true||value.mutationDelivered!==true||value.mutationObserved!==true)failed("test-mutation-unverified");
  if(value.restoreDelivered!==true||value.restoredExact!==true)failed("restore-unverified");
  for(const key of["originalItemCount","originalTypeCount","originalByteCount","restoredItemCount","restoredTypeCount","restoredByteCount"]){if(!Number.isInteger(value[key])||value[key]<0)failed(`invalid-${key}`);}
  if(value.originalItemCount!==value.restoredItemCount||value.originalTypeCount!==value.restoredTypeCount||value.originalByteCount!==value.restoredByteCount)failed("restore-summary-mismatch");
  console.log(`phase9d2c-restoration-backup-complete=PASS itemCount=${value.originalItemCount} typeCount=${value.originalTypeCount} byteCount=${value.originalByteCount}`);
  console.log("phase9d2c-test-mutation-observed=PASS");
  console.log(`phase9d2c-restoration-exact=PASS itemCount=${value.restoredItemCount} typeCount=${value.restoredTypeCount} byteCount=${value.restoredByteCount}`);
  console.log("phase9d2c-restoration-payload-logging=PASS payload=false base64=false digest=false nativeTypeNames=false");
  console.log("physical-phase9d2c-clipboard-restoration-discovery=PASS");
}finally{
  try{fs.unlinkSync(binary);}catch{}
}
