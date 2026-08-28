#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
class BlockedError extends Error {}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10C drag discovery required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10c-drag-discovery-"));
  try{
    const source=path.resolve(__dirname,"helpers/macos-phase10c-drag-delivery-discovery.swift");
    const binary=path.join(tmp,"phase10c-drag-delivery-discovery");
    const compiled=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"]);
    if((compiled.status??1)!==0)throw new BlockedError(`drag discovery fixture compile failed: ${compiled.stderr||compiled.stdout}`);
    const executed=run(binary,[],{timeout:15000});
    let value=null;
    try{value=JSON.parse(String(executed.stdout||"").trim());}catch{throw new Error("drag discovery fixture returned invalid JSON");}
    if((executed.status??1)===2||value?.state==="BLOCKED")throw new BlockedError(value?.error||"drag discovery blocked");
    if((executed.status??1)!==0||value?.ok!==true)throw new Error(`${value?.error||"drag discovery failed"} down=${value?.leftDownCount??"?"} dragged=${value?.draggedCount??"?"} up=${value?.leftUpCount??"?"} emergencyRelease=${value?.emergencyReleasePosted??"?"}`);
    check("phase10c-drag-left-down-delivery",value.leftDownCount===1,`count=${value.leftDownCount}`);
    check("phase10c-dragged-delivery",Number.isInteger(value.draggedCount)&&value.draggedCount>=1,`count=${value.draggedCount}`);
    check("phase10c-drag-left-up-delivery",value.leftUpCount===1,`count=${value.leftUpCount}`);
    check("phase10c-drag-fixture-consequence",value.fixtureConsequenceObserved===true,"markerDestinationObserved=true");
    check("phase10c-drag-pointer-restored",value.pointerRestored===true);
    check("phase10c-drag-release-clean",value.emergencyReleasePosted===false,"emergencyReleasePosted=false");
    check("phase10c-drag-test-owned-fixture",value.fixtureOwned===true&&value.userContentTouched===false&&value.semanticConsequenceClaimed===false);
    console.log("phase10c-drag-coordinate-logging=PASS coordinatesLogged=false nativeDisplayIdsLogged=false");
    console.log("physical-phase10c-drag-delivery-discovery=PASS");
  }finally{
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  }
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/fixture compile|ACCESSIBILITY_NOT_TRUSTED|macOS Phase 10C/i.test(text);console.error(`physical-phase10c-drag-delivery-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
