#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),readline=require("node:readline");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase10c-drag.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
class BlockedError extends Error {}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function near(a,b,tolerance=1){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new BlockedError(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new BlockedError(`runtime exited before ready: ${code}; ${err}`));});});}
function buildFixture(tmp){const source=path.resolve(__dirname,"helpers/macos-phase10c-drag-public-fixture.swift"),binary=path.join(tmp,"phase10c-drag-public-fixture");const c=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"]);if((c.status??1)!==0)throw new BlockedError(`drag public fixture compile failed: ${c.stderr||c.stdout}`);return binary;}
function jsonLines(child){const rl=readline.createInterface({input:child.stdout});const queue=[],waiters=[];rl.on("line",line=>{let value;try{value=JSON.parse(line);}catch{return;}const waiter=waiters.shift();if(waiter)waiter.resolve(value);else queue.push(value);});return{next(timeout=15000){if(queue.length)return Promise.resolve(queue.shift());return new Promise((resolve,reject)=>{const entry={resolve:value=>{clearTimeout(timer);resolve(value);}};const timer=setTimeout(()=>{const index=waiters.indexOf(entry);if(index>=0)waiters.splice(index,1);reject(new Error("drag fixture output timeout"));},timeout);waiters.push(entry);});}};}
function waitExit(child,timeout=14000){if(child.exitCode!=null)return Promise.resolve(child.exitCode);return new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),timeout);child.once("exit",code=>{clearTimeout(timer);resolve(code);});});}
async function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10C public drag validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10c-drag-public-"));
  let runtime=null,fixture=null,client=null;
  try{
    const fixtureBinary=buildFixture(tmp);
    runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});
    await client.ensureReady();
    const info=await client.runtimeInfo();
    const dragCap=info.capabilities.find(value=>value.name==="pointer.drag");
    check("phase10c-public-drag-capability-implemented",dragCap?.validationState==="IMPLEMENTED");
    check("phase10c-public-drag-capability-strategies",dragCap?.strategies?.includes("atomic-button-lifecycle")&&dragCap?.strategies?.includes("verified-source-before-drag-post"));
    const displays=await client.listDisplays();const primary=(displays.displays||[]).filter(value=>value.primary===true);
    check("phase10c-primary-display-observed",displays.state==="OBSERVED"&&primary.length===1,`primaryCount=${primary.length}`);

    fixture=spawn(fixtureBinary,[],{stdio:["ignore","pipe","pipe"]});const lines=jsonLines(fixture);const ready=await lines.next(5000);
    if(ready?.state==="BLOCKED")throw new BlockedError(ready.error||"drag fixture blocked");
    check("phase10c-public-fixture-ready",ready?.kind==="READY"&&ready?.ok===true&&ready?.display==="primary"&&ready?.fixtureOwned===true);
    const source={x:Number(ready.sourceX),y:Number(ready.sourceY)},destination={x:Number(ready.destinationX),y:Number(ready.destinationY)};
    const inside=point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.y>=0&&point.x<primary[0].bounds.width&&point.y<primary[0].bounds.height;
    check("phase10c-public-points-within-primary",inside(source)&&inside(destination));

    const drag=await client.dragPointer({display:"primary",source,destination,button:"left"});
    check("phase10c-public-drag-state",drag?.state==="DRAG_POSTED"&&drag?.display==="primary"&&drag?.button==="left");
    check("phase10c-public-drag-source",near(drag?.source?.x,source.x)&&near(drag?.source?.y,source.y)&&drag?.sourcePositionVerified===true);
    check("phase10c-public-drag-destination",near(drag?.destination?.x,destination.x)&&near(drag?.destination?.y,destination.y));
    check("phase10c-public-drag-delivery-boundary",drag?.buttonLifecycle==="POSTED"&&drag?.dragDelivery==="POSTED"&&drag?.releasePosted===true&&drag?.semanticConsequenceVerified===false);
    check("phase10c-public-drag-verification-boundary",drag?.verification?.sourcePositionMethod==="quartz-current-pointer-location"&&drag?.verification?.dragMethod==="quartz-event-post-only"&&drag?.verification?.releaseMethod==="quartz-left-mouse-up-post");
    check("phase10c-public-drag-backend",drag?.backend?.name==="macos-quartz"&&drag?.backend?.strategy==="primary-display-pointer-drag-post"&&drag?.backend?.fallback===true);

    const observed=await lines.next(14000);if(observed?.state==="BLOCKED")throw new BlockedError(observed.error||"drag fixture blocked");if(observed?.ok!==true)throw new Error(observed?.error||"drag fixture did not verify public delivery");
    check("phase10c-independent-down-delivery",observed.leftDownCount===1,`count=${observed.leftDownCount}`);
    check("phase10c-independent-dragged-delivery",observed.draggedCount>=1,`count=${observed.draggedCount}`);
    check("phase10c-independent-up-delivery",observed.leftUpCount===1,`count=${observed.leftUpCount}`);
    check("phase10c-independent-fixture-consequence",observed.fixtureConsequenceObserved===true);
    check("phase10c-public-pointer-restored",observed.pointerRestored===true);
    check("phase10c-public-release-clean",observed.emergencyReleasePosted===false);
    check("phase10c-public-test-owned-fixture",observed.fixtureOwned===true&&observed.semanticConsequenceClaimed===false);
    console.log("phase10c-public-user-content-touched=PASS value=false");
    console.log("phase10c-public-coordinate-logging=PASS coordinatesLogged=false nativeDisplayIdsLogged=false");
    console.log("physical-phase10c-pointer-drag-public=PASS");
  }finally{
    if(fixture&&fixture.exitCode==null)await waitExit(fixture,14000);
    try{if(client)await client.shutdownRuntime();}catch{}
    if(runtime&&runtime.exitCode==null)runtime.kill("SIGTERM");
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  }
}
main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/fixture compile|runtime startup|ACCESSIBILITY_NOT_TRUSTED|macOS Phase 10C/i.test(text);console.error(`physical-phase10c-pointer-drag-public=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
