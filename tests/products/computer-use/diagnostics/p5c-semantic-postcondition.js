#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT||"/Volumes/RumiAI/rumiai-portable-runtime/app/computer-use";
const semanticFixtureSource=path.join(__dirname,"..","physical-tests","helpers","macos-perception-p5c-semantic-fixture.swift");
const SEMANTIC_APP="RumiAI P5C Semantic Fixture";
const SEMANTIC_PROCESS="RumiAIP5CSemanticFixture";
const SEMANTIC_BUNDLE="ai.rumiai.computer-use.p5c-semantic-fixture";
const SEMANTIC_TARGET="RUMIAI SEMANTIC 731";

function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024});}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function fail(code){const e=new Error(code);e.code=code;throw e;}
function killFixture(){run("/usr/bin/pkill",["-x",SEMANTIC_PROCESS]);}
function oneLine(value,limit=1200){return String(value||"").replace(/\s+/g," ").trim().slice(0,limit);}
function prepare(tmp){
  const appBundle=path.join(tmp,`${SEMANTIC_PROCESS}.app`);
  const contents=path.join(appBundle,"Contents");
  const macos=path.join(contents,"MacOS");
  fs.mkdirSync(macos,{recursive:true});
  const binary=path.join(macos,SEMANTIC_PROCESS);
  const compiled=run("/usr/bin/xcrun",["swiftc",semanticFixtureSource,"-o",binary,"-framework","AppKit"]);
  if((compiled.status??1)!==0)fail("SEMANTIC_FIXTURE_COMPILE_FAILED");
  fs.writeFileSync(path.join(contents,"Info.plist"),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>${SEMANTIC_PROCESS}</string><key>CFBundleIdentifier</key><string>${SEMANTIC_BUNDLE}</string><key>CFBundleName</key><string>${SEMANTIC_APP}</string><key>CFBundleDisplayName</key><string>${SEMANTIC_APP}</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string></dict></plist>`);
  const providerDir=path.join(tmp,"providers");
  fs.mkdirSync(providerDir,{recursive:true});
  fs.writeFileSync(path.join(providerDir,"p5c-semantic-fixture.json"),JSON.stringify({
    id:"rumiai-p5c-semantic-fixture",name:SEMANTIC_APP,kind:"application",aliases:[SEMANTIC_APP],
    activation:{application:SEMANTIC_PROCESS},availability:{type:"paths",paths:[appBundle]},
    contexts:["native-controls","appkit","p5c-semantic-first"],capabilities:{},
    identity:{process:SEMANTIC_PROCESS,bundle:SEMANTIC_BUNDLE}
  },null,2));
  return {appBundle,providerDir};
}
function marker(snapshot,token){
  const lines=String(snapshot||"").split("\n").filter(line=>line.includes(`\"${SEMANTIC_TARGET}\"`));
  return lines.some(line=>line.includes(token));
}
function detailBool(detail,key){
  const m=String(detail||"").match(new RegExp(`${key}=(true|false)`));
  return m?m[1]:"missing";
}

(async()=>{
  let tmp=null,cc=null,opened=false;
  try{
    console.log("p5c-semantic-postcondition-diagnostic=START");
    killFixture();sleep(150);
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p5c-semantic-diagnostic-"));
    const prepared=prepare(tmp);
    process.env.RUMIAI_PROVIDER_DIR=prepared.providerDir;
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"computer-control.sock");
    const executors=require(path.join(productRoot,"app","executors.js"));
    const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
    cc=require(path.join(productRoot,"app","computer-control-external.js"));

    const launch=run("/usr/bin/open",[prepared.appBundle]);
    if((launch.status??1)!==0)fail("SEMANTIC_FIXTURE_LAUNCH_FAILED");
    opened=true;sleep(650);

    const inventory=cc.listApplications({availableOnly:true});
    console.log(`provider-list-ok=${inventory?.ok!==false}`);
    if(inventory?.ok===false){
      console.log(`provider-list-error=${inventory?.error||"UNKNOWN"}`);
      console.log(`provider-list-detail=${oneLine(inventory?.detail)||"<empty>"}`);
      console.log(`provider-list-state=${inventory?.state||"UNKNOWN"}`);
    }
    const semanticEntry=Array.isArray(inventory?.applications)
      ? inventory.applications.find(item=>item?.name===SEMANTIC_APP)
      : null;
    console.log(`provider-available=${semanticEntry?.available===true}`);
    console.log(`provider-running=${semanticEntry?.running===true}`);
    if(!semanticEntry?.available)fail("SEMANTIC_FIXTURE_PROVIDER_UNAVAILABLE");

    const activated=cc.activateApplication({app:SEMANTIC_APP,timeoutMs:10000});
    console.log(`activate-ok=${activated?.ok===true}`);
    if(!activated?.ok){
      console.log(`activate-error=${activated?.error||"UNKNOWN"}`);
      console.log(`activate-detail=${oneLine(activated?.detail)||"<empty>"}`);
      fail(`SEMANTIC_FIXTURE_ACTIVATE_FAILED_${activated?.error||"UNKNOWN"}`);
    }
    const initial=cc.snapshot({app:SEMANTIC_APP});
    if(!initial?.ok||!initial.snapshot)fail(`INITIAL_SNAPSHOT_FAILED_${initial?.error||"UNKNOWN"}`);
    const resolved=semanticUi.resolveSemanticTarget(initial.snapshot,SEMANTIC_TARGET,null,"CLICK",SEMANTIC_APP);
    if(!resolved?.ok)fail(`TARGET_UNRESOLVED_${resolved?.code||"UNKNOWN"}`);
    const before=cc.describe({app:SEMANTIC_APP,element:{ref:resolved.ref}});

    const result=await executors.executeOpenSemanticIntent(
      {intent:"OPEN",target:SEMANTIC_TARGET},
      {currentApp:SEMANTIC_APP,snapshot:initial.snapshot,changed:false}
    );

    const after=cc.snapshot({app:SEMANTIC_APP});
    const afterResolved=after?.ok?semanticUi.resolveSemanticTarget(after.snapshot,SEMANTIC_TARGET,null,"CLICK",SEMANTIC_APP):null;
    const afterDescription=afterResolved?.ok?cc.describe({app:SEMANTIC_APP,element:{ref:afterResolved.ref}}):null;
    const window=cc.getCurrentWindow({app:SEMANTIC_APP});
    const titleMatches=window?.ok&&semanticUi.normText(window.window?.title).includes(semanticUi.normText(SEMANTIC_TARGET));

    console.log(`semantic-result-ok=${result?.ok===true}`);
    console.log(`semantic-result-code=${result?.code||"none"}`);
    console.log(`semantic-result-selected=${detailBool(result?.detail,"selected")}`);
    console.log(`semantic-result-window-observed=${detailBool(result?.detail,"windowObserved")}`);
    console.log(`semantic-result-title-matches=${detailBool(result?.detail,"titleMatches")}`);
    console.log(`before-role=${before?.role||"unknown"}`);
    console.log(`before-selected=${String(before?.selected)}`);
    console.log(`before-checked=${String(before?.checked)}`);
    console.log(`after-snapshot-ok=${after?.ok===true}`);
    console.log(`after-target-resolved=${afterResolved?.ok===true}`);
    console.log(`after-marker-selected=${after?.ok?marker(after.snapshot,"[selected]"):false}`);
    console.log(`after-marker-checked=${after?.ok?marker(after.snapshot,"[checked]"):false}`);
    console.log(`after-marker-focused=${after?.ok?marker(after.snapshot,"[focused]"):false}`);
    console.log(`after-described-selected=${String(afterDescription?.selected)}`);
    console.log(`after-described-checked=${String(afterDescription?.checked)}`);
    console.log(`after-window-observed=${window?.ok===true}`);
    console.log(`after-window-title-matches=${titleMatches}`);
    console.log("p5c-semantic-postcondition-diagnostic=PASS");
  }catch(error){
    console.log(`p5c-semantic-postcondition-diagnostic=FAIL code=${error.code||error.message||"UNEXPECTED"}`);
    process.exitCode=1;
  }finally{
    try{if(cc&&opened)cc.terminateApplication({app:SEMANTIC_APP,timeoutMs:10000});}catch{}
    try{if(cc)cc.shutdownRuntime();}catch{}
    killFixture();
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
  }
})();
