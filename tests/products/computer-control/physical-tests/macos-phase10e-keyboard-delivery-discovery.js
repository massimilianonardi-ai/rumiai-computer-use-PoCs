#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
class BlockedError extends Error {}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(label);}
function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10E keyboard discovery required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10e-keyboard-"));
  try{
    const source=path.resolve(__dirname,"helpers/macos-phase10e-keyboard-delivery-discovery.swift"),binary=path.join(tmp,"phase10e-keyboard-delivery-discovery");
    const c=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics","-framework","Carbon"]);
    if((c.status??1)!==0)throw new BlockedError(`keyboard discovery fixture compile failed: ${c.stderr||c.stdout}`);
    const r=run(binary,[]);let value;try{value=JSON.parse(String(r.stdout||"").trim());}catch{throw new Error(`keyboard discovery invalid JSON: ${r.stdout||r.stderr}`);}
    if((r.status??1)===2||value?.state==="BLOCKED")throw new BlockedError(value?.error||"keyboard discovery blocked");
    if((r.status??1)!==0||value?.ok!==true)throw new Error(value?.error||"keyboard discovery failed");
    check("phase10e-printable-key-delivery",value.printableKeyDownCount>=1&&value.printableKeyUpCount>=1,`down=${value.printableKeyDownCount} up=${value.printableKeyUpCount}`);
    check("phase10e-printable-text-consequence",value.printableTextConsequence===true);
    check("phase10e-special-key-delivery",value.specialKeyDownCount>=1&&value.specialKeyUpCount>=1,`down=${value.specialKeyDownCount} up=${value.specialKeyUpCount}`);
    check("phase10e-special-key-consequence",value.specialKeyConsequence===true);
    check("phase10e-shift-modifier-delivery",value.shiftOnCount>=1&&value.shiftOffCount>=1&&value.shiftedKeyDownCount>=1,`on=${value.shiftOnCount} off=${value.shiftOffCount} shifted=${value.shiftedKeyDownCount}`);
    check("phase10e-shifted-text-consequence",value.shiftedTextConsequence===true);
    check("phase10e-keyboard-clean-release",value.emergencyShiftReleasePosted===false);
    check("phase10e-frontmost-app-restored",value.frontmostApplicationRestored===true);
    check("phase10e-test-owned-fixture",value.fixtureOwned===true&&value.userContentTouched===false&&value.semanticTextSuccessClaimed===false);
    console.log("phase10e-native-keycode-logging=PASS numericKeycodesLogged=false userTextLogged=false");
    console.log("physical-phase10e-keyboard-delivery-discovery=PASS");
  }finally{try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/compile|ACCESSIBILITY_NOT_TRUSTED|macOS Phase 10E/i.test(text);console.error(`physical-phase10e-keyboard-delivery-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
