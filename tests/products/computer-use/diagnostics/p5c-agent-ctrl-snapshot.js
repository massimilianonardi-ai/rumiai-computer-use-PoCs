#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");

const controlRoot=process.env.RUMIAI_COMPUTER_CONTROL_HOME || "/Volumes/RumiAI/rumiai-portable-runtime/lib/computer-control";
const agent=path.join(controlRoot,"backends","macos","runtime","bin","agent-ctrl");
const adapter=path.join(controlRoot,"adapters","rumiai","compat.js");
const expectedAgentSha="68b3a6a17b068d2a5ddbc39a422c84fdb21cd620059ed913b0469ada61bc3378";
const app="System Settings";

function oneLine(value,limit=1200){
  return String(value||"").replace(/\s+/g," ").trim().slice(0,limit);
}
function run(cmd,args){
  return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:32*1024*1024});
}
function sha256(file){
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function safeResult(value){
  return {
    ok:value?.ok===true,
    state:value?.state||null,
    error:value?.error||null,
    detail:oneLine(value?.detail),
    method:value?.method||null,
    snapshotBytes:typeof value?.snapshot==="string"?Buffer.byteLength(value.snapshot):0,
  };
}

let cc=null;
let wasRunning=true;
let exitCode=1;
try{
  console.log("p5c-snapshot-diagnostic=START");
  const exists=fs.existsSync(agent);
  console.log(`agent-ctrl-exists=${exists?"PASS":"FAIL"}`);
  if(!exists)throw new Error("AGENT_CTRL_MISSING");

  const st=fs.statSync(agent);
  const executable=(st.mode&0o111)!==0;
  const actualSha=sha256(agent);
  console.log(`agent-ctrl-executable=${executable?"PASS":"FAIL"}`);
  console.log(`agent-ctrl-sha256=${actualSha}`);
  console.log(`agent-ctrl-installer-sha=${actualSha===expectedAgentSha?"MATCH":"MISMATCH"}`);

  const listed=run(agent,["list"]);
  console.log(`agent-ctrl-list-exit=${listed.status??1}`);
  console.log(`agent-ctrl-list-stderr=${oneLine(listed.stderr) || "<empty>"}`);

  process.env.RUMIAI_COMPUTER_CONTROL_HOME=controlRoot;
  cc=require(adapter);

  const inventory=cc.listApplications({availableOnly:true});
  const entry=Array.isArray(inventory?.applications)
    ? inventory.applications.find(v=>v?.name===app)
    : null;
  console.log(`system-settings-provider=${entry?.available===true?"PASS":"FAIL"}`);
  wasRunning=entry?.running===true;

  const launched=cc.launchApplication({app,timeoutMs:10000});
  console.log(`adapter-launch=${launched?.ok===true?"PASS":"FAIL"} state=${launched?.state||"null"} error=${launched?.error||"null"}`);
  const activated=cc.activateApplication({app,timeoutMs:10000});
  console.log(`adapter-activate=${activated?.ok===true?"PASS":"FAIL"} state=${activated?.state||"null"} error=${activated?.error||"null"}`);

  const snap=cc.snapshot({app});
  const summary=safeResult(snap);
  console.log(`adapter-snapshot=${summary.ok?"PASS":"FAIL"}`);
  console.log(`adapter-snapshot-summary=${JSON.stringify(summary)}`);

  const direct=run(agent,["snapshot","--target-process",app]);
  console.log(`direct-snapshot-exit=${direct.status??1}`);
  console.log(`direct-snapshot-bytes=${Buffer.byteLength(direct.stdout||"")}`);
  console.log(`direct-snapshot-stderr=${oneLine(direct.stderr) || "<empty>"}`);

  if(actualSha!==expectedAgentSha){
    console.log("p5c-snapshot-diagnostic=FAIL class=AGENT_CTRL_BINARY_MISMATCH");
  }else if(summary.ok && (direct.status??1)===0 && Buffer.byteLength(direct.stdout||"")>0){
    console.log("p5c-snapshot-diagnostic=PASS class=SNAPSHOT_AVAILABLE");
    exitCode=0;
  }else if(/permission|accessibility|not trusted|denied|ax/i.test(`${summary.detail} ${direct.stderr||""}`)){
    console.log("p5c-snapshot-diagnostic=BLOCKED class=AX_PERMISSION_OR_TRUST");
    exitCode=2;
  }else{
    console.log("p5c-snapshot-diagnostic=FAIL class=SNAPSHOT_RUNTIME_OR_TARGETING");
  }
}catch(error){
  console.log(`p5c-snapshot-diagnostic=FAIL class=DIAGNOSTIC_EXCEPTION detail=${oneLine(error?.message||error)}`);
}finally{
  try{
    if(cc && !wasRunning)cc.terminateApplication({app,timeoutMs:10000});
  }catch{}
  try{if(cc)cc.shutdownRuntime();}catch{}
  process.exitCode=exitCode;
}
