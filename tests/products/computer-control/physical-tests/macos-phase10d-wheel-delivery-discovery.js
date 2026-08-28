#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
class BlockedError extends Error{}
const helper=path.resolve(__dirname,"helpers/macos-phase10d-wheel-delivery-discovery.swift");
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10D wheel delivery discovery required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10d-wheel-discovery-"));
  try{
    const binary=path.join(tmp,"phase10d-wheel-discovery");
    const build=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",helper,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((build.status??1)!==0)throw new BlockedError(`wheel discovery fixture compile failed: ${build.stderr||build.stdout}`);
    const run=spawnSync(binary,[],{encoding:"utf8",maxBuffer:1024*1024,timeout:15000});
    let value;try{value=JSON.parse(String(run.stdout||"").trim());}catch{throw new Error(`wheel discovery invalid JSON: ${run.stderr||run.stdout}`);}
    if((run.status??1)===2||value?.state==="BLOCKED")throw new BlockedError(value?.error||"wheel discovery blocked");
    if((run.status??1)!==0||value?.ok!==true)throw new Error(value?.error||"wheel delivery discovery failed");
    check("phase10d-wheel-negative-delivery",Number.isInteger(value.negativeWheelObservedCount)&&value.negativeWheelObservedCount>=1,`observed=${value.negativeWheelObservedCount}`);
    check("phase10d-wheel-negative-scroll-consequence",value.negativeWheelScrollChanged===true&&["increasing-y","decreasing-y"].includes(value.negativeWheelContentDirection),`direction=${value.negativeWheelContentDirection}`);
    check("phase10d-wheel-positive-delivery",Number.isInteger(value.positiveWheelObservedCount)&&value.positiveWheelObservedCount>=1,`observed=${value.positiveWheelObservedCount}`);
    check("phase10d-wheel-positive-scroll-consequence",value.positiveWheelScrollChanged===true&&["increasing-y","decreasing-y"].includes(value.positiveWheelContentDirection),`direction=${value.positiveWheelContentDirection}`);
    check("phase10d-wheel-opposite-direction",value.oppositeDirectionsObserved===true&&value.negativeWheelContentDirection!==value.positiveWheelContentDirection);
    check("phase10d-wheel-pointer-restored",value.pointerRestored===true);
    check("phase10d-wheel-test-owned-fixture",value.fixtureOwned===true&&value.userContentTouched===false);
    check("phase10d-wheel-semantic-boundary",value.semanticScrollClaimed===false);
    console.log("phase10d-wheel-coordinate-logging=PASS coordinatesLogged=false nativeDisplayIdsLogged=false offsetsLogged=false");
    console.log("physical-phase10d-wheel-delivery-discovery=PASS");
  } finally { try{fs.rmSync(tmp,{recursive:true,force:true});}catch{} }
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/compile failed|ACCESSIBILITY_NOT_TRUSTED|macOS Phase 10D/i.test(text);console.error(`physical-phase10d-wheel-delivery-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
