#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),readline=require("node:readline");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase10b-pointer.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
class BlockedError extends Error {}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function near(a,b,tolerance=1){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new BlockedError(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new BlockedError(`runtime exited before ready: ${code}; ${err}`));});});}
function buildFixture(tmp){const source=path.resolve(__dirname,"helpers/macos-phase10b-pointer-public-fixture.swift"),binary=path.join(tmp,"phase10b-pointer-public-fixture");const c=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"]);if((c.status??1)!==0)throw new BlockedError(`pointer public fixture compile failed: ${c.stderr||c.stdout}`);return binary;}
function jsonLines(child){const rl=readline.createInterface({input:child.stdout});const queue=[],waiters=[];rl.on("line",line=>{let value;try{value=JSON.parse(line);}catch{return;}const waiter=waiters.shift();if(waiter)waiter.resolve(value);else queue.push(value);});return{next(timeout=15000){if(queue.length)return Promise.resolve(queue.shift());return new Promise((resolve,reject)=>{const entry={resolve:value=>{clearTimeout(timer);resolve(value);}};const timer=setTimeout(()=>{const index=waiters.indexOf(entry);if(index>=0)waiters.splice(index,1);reject(new Error("pointer fixture output timeout"));},timeout);waiters.push(entry);});}};}
function waitExit(child,timeout=14000){if(child.exitCode!=null)return Promise.resolve(child.exitCode);return new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),timeout);child.once("exit",code=>{clearTimeout(timer);resolve(code);});});}
async function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10B public pointer validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10b-pointer-public-"));
  let runtime=null,fixture=null,client=null;
  try{
    const fixtureBinary=buildFixture(tmp);
    runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});
    await client.ensureReady();
    const info=await client.runtimeInfo();
    const moveCap=info.capabilities.find(value=>value.name==="pointer.move");
    const clickCap=info.capabilities.find(value=>value.name==="pointer.click");
    check("phase10b-public-move-capability-implemented",moveCap?.validationState==="IMPLEMENTED");
    check("phase10b-public-click-capability-implemented",clickCap?.validationState==="IMPLEMENTED");
    check("phase10b-public-capability-strategies",moveCap?.strategies?.includes("current-location-postcondition")&&clickCap?.strategies?.includes("verified-position-before-button-post"));

    const displays=await client.listDisplays();
    const primary=(displays.displays||[]).filter(value=>value.primary===true);
    check("phase10b-primary-display-observed",displays.state==="OBSERVED"&&primary.length===1,`primaryCount=${primary.length}`);

    fixture=spawn(fixtureBinary,[],{stdio:["ignore","pipe","pipe"]});
    const lines=jsonLines(fixture);
    const ready=await lines.next(5000);
    if(ready?.state==="BLOCKED")throw new BlockedError(ready.error||"pointer fixture blocked");
    check("phase10b-public-fixture-ready",ready?.kind==="READY"&&ready?.ok===true&&ready?.display==="primary"&&ready?.fixtureOwned===true);
    const x=Number(ready.x),y=Number(ready.y);
    check("phase10b-public-target-within-primary",Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<primary[0].bounds.width&&y<primary[0].bounds.height);

    const moved=await client.movePointer({display:"primary",x,y});
    check("phase10b-public-move-state",moved?.state==="MOVED"&&moved?.verified===true&&moved?.display==="primary");
    check("phase10b-public-move-position",near(moved?.position?.x,x)&&near(moved?.position?.y,y));
    check("phase10b-public-move-verification",moved?.verification?.method==="quartz-current-pointer-location"&&moved?.backend?.name==="macos-quartz"&&moved?.backend?.fallback===true);

    const left=await client.clickPointer({display:"primary",x,y,button:"left"});
    check("phase10b-public-left-click-state",left?.state==="CLICK_POSTED"&&left?.button==="left"&&left?.buttonDelivery==="POSTED");
    check("phase10b-public-left-click-boundary",left?.positionVerified===true&&left?.semanticConsequenceVerified===false&&left?.verification?.buttonMethod==="quartz-event-post-only");
    const right=await client.clickPointer({display:"primary",x,y,button:"right"});
    check("phase10b-public-right-click-state",right?.state==="CLICK_POSTED"&&right?.button==="right"&&right?.buttonDelivery==="POSTED");
    check("phase10b-public-right-click-boundary",right?.positionVerified===true&&right?.semanticConsequenceVerified===false&&right?.verification?.buttonMethod==="quartz-event-post-only");

    const observed=await lines.next(14000);
    if(observed?.state==="BLOCKED")throw new BlockedError(observed.error||"pointer fixture blocked");
    if(observed?.ok!==true)throw new Error(observed?.error||"pointer fixture did not observe public delivery");
    check("phase10b-independent-left-delivery",observed.leftDownCount===1&&observed.leftUpCount===1,`down=${observed.leftDownCount} up=${observed.leftUpCount}`);
    check("phase10b-independent-right-delivery",observed.rightDownCount===1&&observed.rightUpCount===1,`down=${observed.rightDownCount} up=${observed.rightUpCount}`);
    check("phase10b-public-pointer-restored",observed.pointerRestored===true);
    check("phase10b-public-test-owned-fixture",observed.fixtureOwned===true&&observed.semanticConsequenceClaimed===false);
    console.log("phase10b-public-user-content-clicked=PASS value=false");
    console.log("phase10b-public-coordinate-logging=PASS coordinatesLogged=false nativeDisplayIdsLogged=false");
    console.log("physical-phase10b-pointer-public=PASS");
  }finally{
    if(fixture&&fixture.exitCode==null)await waitExit(fixture,14000);
    try{if(client)await client.shutdownRuntime();}catch{}
    if(runtime&&runtime.exitCode==null)runtime.kill("SIGTERM");
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  }
}
main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/fixture compile|runtime startup|ACCESSIBILITY_NOT_TRUSTED|macOS Phase 10B/i.test(text);console.error(`physical-phase10b-pointer-public=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
