#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
class BlockedError extends Error {}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS pointer delivery discovery required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10b-pointer-"));
  try{
    const source=path.resolve(__dirname,"helpers/macos-phase10b-pointer-delivery-discovery.swift");
    const binary=path.join(tmp,"phase10b-pointer-delivery-discovery");
    const compiled=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"]);
    if((compiled.status??1)!==0)throw new BlockedError(`pointer discovery compile failed: ${compiled.stderr||compiled.stdout}`);
    const executed=run(binary,[],{timeout:15000});
    let value=null;try{value=JSON.parse(String(executed.stdout||"").trim());}catch{throw new Error("pointer discovery returned invalid JSON");}
    if((executed.status??1)===2||value?.state==="BLOCKED")throw new BlockedError(value?.error||"pointer discovery blocked");
    if((executed.status??1)!==0||value?.ok!==true||value?.state!=="OBSERVED")throw new Error(value?.error||executed.stderr||"pointer discovery failed");
    check("phase10b-pointer-move-delivery",value.moveDelivered===true);
    check("phase10b-left-button-delivery",value.leftDownCount===1&&value.leftUpCount===1,`down=${value.leftDownCount} up=${value.leftUpCount}`);
    check("phase10b-right-button-delivery",value.rightDownCount===1&&value.rightUpCount===1,`down=${value.rightDownCount} up=${value.rightUpCount}`);
    check("phase10b-test-owned-fixture",value.fixtureOwned===true&&value.method==="quartz-post-to-test-owned-appkit-fixture");
    check("phase10b-pointer-restored",value.pointerRestored===true);
    check("phase10b-no-semantic-consequence-claim",value.semanticConsequenceClaimed===false);
    console.log("phase10b-user-content-clicked=PASS value=false");
    console.log("physical-phase10b-pointer-delivery-discovery=PASS");
  }finally{try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/swiftc|xcrun|ACCESSIBILITY_NOT_TRUSTED|DISPLAY_TOO_SMALL/i.test(text);console.error(`physical-phase10b-pointer-delivery-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
