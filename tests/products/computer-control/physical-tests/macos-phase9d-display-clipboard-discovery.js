#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function finiteRect(value){return value&&[value.x,value.y,value.width,value.height].every(Number.isFinite)&&value.width>0&&value.height>0;}
function main(){
  if(process.platform!=="darwin")throw new Error("macOS Phase 9D physical discovery required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase9d-discovery-"));
  try{
    const source=path.resolve(__dirname,"helpers/macos-phase9d-display-clipboard-discovery.swift");
    const binary=path.join(tmp,"phase9d-discovery");
    const compile=run("/usr/bin/xcrun",["swiftc",source,"-o",binary,"-framework","AppKit","-framework","CoreGraphics"]);
    if(compile.status!==0)throw new Error(`Phase 9D discovery helper compile failed: ${compile.stderr||compile.stdout}`);
    const observed=run(binary,[]);
    if(observed.status!==0)throw new Error(`Phase 9D discovery helper failed: ${observed.stderr||observed.stdout}`);
    const data=JSON.parse(String(observed.stdout||"").trim());
    console.log("phase9d-discovery="+JSON.stringify(data));
    check("phase9d-helper-ok",data?.ok===true);
    check("phase9d-method",data?.method==="macos-phase9d-display-and-clipboard-read-only-safe-discovery",JSON.stringify({method:data?.method}));

    const displays=Array.isArray(data?.displays)?data.displays:[];
    check("phase9d-display-count",displays.length>0,JSON.stringify({count:displays.length}));
    check("phase9d-display-main-count",displays.filter(value=>value.main===true).length===1,JSON.stringify({main:displays.filter(value=>value.main===true).length}));
    for(const [index,display] of displays.entries()){
      check(`phase9d-display-${index}-id`,Number.isInteger(display.displayID)&&display.displayID>0,JSON.stringify({displayID:display.displayID}));
      check(`phase9d-display-${index}-name`,typeof display.name==="string"&&display.name.length>0,JSON.stringify({name:display.name}));
      check(`phase9d-display-${index}-frame`,finiteRect(display.frame),JSON.stringify(display.frame));
      check(`phase9d-display-${index}-visible-frame`,finiteRect(display.visibleFrame),JSON.stringify(display.visibleFrame));
      check(`phase9d-display-${index}-pixels`,Number.isInteger(display.pixelWidth)&&display.pixelWidth>0&&Number.isInteger(display.pixelHeight)&&display.pixelHeight>0,JSON.stringify({pixelWidth:display.pixelWidth,pixelHeight:display.pixelHeight}));
      check(`phase9d-display-${index}-scale`,Number.isFinite(display.backingScaleFactor)&&display.backingScaleFactor>0,JSON.stringify({backingScaleFactor:display.backingScaleFactor}));
      check(`phase9d-display-${index}-rotation`,Number.isFinite(display.rotationDegrees),JSON.stringify({rotationDegrees:display.rotationDegrees}));
      check(`phase9d-display-${index}-active-online`,display.active===true&&display.online===true,JSON.stringify({active:display.active,online:display.online}));
      check(`phase9d-display-${index}-builtin`,typeof display.builtin==="boolean",JSON.stringify({builtin:display.builtin}));
    }

    const before=data?.generalPasteboardBefore,after=data?.generalPasteboardAfter;
    check("phase9d-general-pasteboard-before-shape",before&&Number.isInteger(before.changeCount)&&Number.isInteger(before.itemCount)&&Array.isArray(before.itemTypes)&&Array.isArray(before.uniqueTypes));
    check("phase9d-general-pasteboard-after-shape",after&&Number.isInteger(after.changeCount)&&Number.isInteger(after.itemCount)&&Array.isArray(after.itemTypes)&&Array.isArray(after.uniqueTypes));
    check("phase9d-general-pasteboard-unchanged",data?.generalPasteboardUnchanged===true,JSON.stringify({beforeChangeCount:before?.changeCount,afterChangeCount:after?.changeCount,beforeItemCount:before?.itemCount,afterItemCount:after?.itemCount}));
    check("phase9d-general-pasteboard-no-payload",!JSON.stringify({before,after}).includes("RumiAI Phase 9D isolated text"));

    const isolated=data?.isolatedPasteboard;
    check("phase9d-isolated-types",Array.isArray(isolated?.advertisedTypes)&&isolated.advertisedTypes.length>=4,JSON.stringify(isolated?.advertisedTypes));
    const probes=Array.isArray(isolated?.probes)?isolated.probes:[];
    check("phase9d-isolated-probe-count",probes.length===4,JSON.stringify({count:probes.length}));
    for(const probe of probes){
      check(`phase9d-isolated-${probe.type}-write`,probe.writeAccepted===true);
      check(`phase9d-isolated-${probe.type}-readback`,probe.readbackMatched===true);
      check(`phase9d-isolated-${probe.type}-bytes`,Number.isInteger(probe.byteCount)&&probe.byteCount>0,JSON.stringify({byteCount:probe.byteCount}));
      check(`phase9d-isolated-${probe.type}-advertised`,isolated.advertisedTypes.includes(probe.type));
    }
    console.log("physical-phase9d-display-clipboard-discovery=PASS");
  }finally{
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch(_){}
  }
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=/xcrun|swiftc|macOS Phase 9D|display-count|display-main-count/i.test(text);console.error(`physical-phase9d-display-clipboard-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
