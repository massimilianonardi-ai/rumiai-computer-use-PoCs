#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:32*1024*1024});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function main(){
  if(process.platform!=="darwin")throw new Error("macOS system chrome physical discovery required");
  const source=path.resolve(__dirname,"helpers/macos-system-chrome-topology.swift");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-system-chrome-discovery-"));
  try{
    const binary=path.join(tmp,"system-chrome-topology");
    const compile=run("/usr/bin/xcrun",["swiftc",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices"]);
    if(compile.status!==0)throw new Error(`xcrun swiftc unavailable or system chrome helper compile failed: ${compile.stderr||compile.stdout}`);
    const executed=run(binary,[]);
    if(executed.status!==0)throw new Error(`system chrome topology helper failed: ${executed.stderr||executed.stdout}`);
    const parsed=JSON.parse(String(executed.stdout||"").trim());
    console.log("phase9c23-system-chrome-topology-json="+JSON.stringify(parsed));
    check("phase9c2-dock-process",parsed?.dock?.runningCount>=1,JSON.stringify({bundle:parsed?.dock?.bundleIdentifier,runningCount:parsed?.dock?.runningCount,pid:parsed?.dock?.pid}));
    const dockItems=(parsed?.dock?.nodes||[]).filter(node=>node.role==="AXDockItem");
    check("phase9c2-dock-items-visible",dockItems.length>0,`count=${dockItems.length}`);
    console.log("phase9c2-dock-subroles="+JSON.stringify([...new Set(dockItems.map(node=>node.subrole).filter(Boolean))].sort()));
    const runningOwners=(parsed?.menuExtraCandidates||[]).filter(candidate=>candidate.runningCount>0);
    check("phase9c3-owner-process-present",runningOwners.length>0,JSON.stringify((parsed?.menuExtraCandidates||[]).map(candidate=>({label:candidate.label,bundle:candidate.bundleIdentifier,runningCount:candidate.runningCount}))));
    for(const candidate of runningOwners){
      console.log(`phase9c3-owner-${candidate.label}=`+JSON.stringify({bundle:candidate.bundleIdentifier,pid:candidate.pid,appRole:candidate.appRole,extrasMenuBarPresent:candidate.extrasMenuBarPresent,extrasMenuBarRole:candidate.extrasMenuBarRole,nodeCount:(candidate.nodes||[]).length,extrasNodeCount:(candidate.extrasNodes||[]).length}));
    }
    console.log("physical-phase9c23-system-chrome-discovery=PASS");
  } finally {
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch(_){}
  }
}
try{main();}catch(error){const text=String(error?.stack||error?.message||error);const blocked=/xcrun|swiftc|permission|Accessibility|owner-process-present|owner-unavailable|BACKEND_UNAVAILABLE/i.test(text);console.error(`physical-phase9c23-system-chrome-discovery=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);}
