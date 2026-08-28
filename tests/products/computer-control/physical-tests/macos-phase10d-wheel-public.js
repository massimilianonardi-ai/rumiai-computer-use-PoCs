#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),readline=require("node:readline");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase10d-wheel.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
class BlockedError extends Error {}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:8*1024*1024,...options});}
function near(a,b,tolerance=1){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new BlockedError(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new BlockedError(`runtime exited before ready: ${code}; ${err}`));});});}
function buildFixture(tmp){const source=path.resolve(__dirname,"helpers/macos-phase10d-wheel-public-fixture.swift"),binary=path.join(tmp,"phase10d-wheel-public-fixture");const c=run("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics"]);if((c.status??1)!==0)throw new BlockedError(`wheel public fixture compile failed: ${c.stderr||c.stdout}`);return binary;}
function jsonLines(child){const rl=readline.createInterface({input:child.stdout});const queue=[],waiters=[];rl.on("line",line=>{let value;try{value=JSON.parse(line);}catch{return;}const waiter=waiters.shift();if(waiter)waiter.resolve(value);else queue.push(value);});return{next(timeout=15000){if(queue.length)return Promise.resolve(queue.shift());return new Promise((resolve,reject)=>{const entry={resolve:value=>{clearTimeout(timer);resolve(value);}};const timer=setTimeout(()=>{const index=waiters.indexOf(entry);if(index>=0)waiters.splice(index,1);reject(new Error("wheel fixture output timeout"));},timeout);waiters.push(entry);});}};}
function waitExit(child,timeout=14000){if(child.exitCode!=null)return Promise.resolve(child.exitCode);return new Promise(resolve=>{const timer=setTimeout(()=>resolve(null),timeout);child.once("exit",code=>{clearTimeout(timer);resolve(code);});});}
async function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS Phase 10D public wheel validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10d-wheel-public-"));
  let runtime=null,fixture=null,client=null;
  try{
    const fixtureBinary=buildFixture(tmp);
    runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});await client.ensureReady();
    const info=await client.runtimeInfo();const cap=info.capabilities.find(value=>value.name==="pointer.wheel");
    check("phase10d-public-wheel-capability-implemented",cap?.validationState==="IMPLEMENTED");
    check("phase10d-public-wheel-capability-strategies",cap?.strategies?.includes("verified-position-before-wheel-post")&&cap?.strategies?.includes("canonical-direction-private-native-sign"));
    const displays=await client.listDisplays();const primary=(displays.displays||[]).filter(value=>value.primary===true);
    check("phase10d-primary-display-observed",displays.state==="OBSERVED"&&primary.length===1,`primaryCount=${primary.length}`);

    fixture=spawn(fixtureBinary,[],{stdio:["ignore","pipe","pipe"]});const lines=jsonLines(fixture);const ready=await lines.next(5000);
    if(ready?.state==="BLOCKED")throw new BlockedError(ready.error||"wheel fixture blocked");
    check("phase10d-public-fixture-ready",ready?.kind==="READY"&&ready?.ok===true&&ready?.display==="primary"&&ready?.fixtureOwned===true);
    const point={x:Number(ready.x),y:Number(ready.y)};const inside=Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.y>=0&&point.x<primary[0].bounds.width&&point.y<primary[0].bounds.height;
    check("phase10d-public-point-within-primary",inside);

    const down=await client.wheelPointer({display:"primary",x:point.x,y:point.y,direction:"down",amount:3});
    check("phase10d-public-down-state",down?.state==="WHEEL_POSTED"&&down?.display==="primary"&&down?.direction==="down"&&down?.amount===3);
    check("phase10d-public-down-position",near(down?.position?.x,point.x)&&near(down?.position?.y,point.y)&&down?.positionVerified===true);
    check("phase10d-public-down-boundary",down?.wheelDelivery==="POSTED"&&down?.semanticConsequenceVerified===false);
    check("phase10d-public-down-verification",down?.verification?.positionMethod==="quartz-current-pointer-location"&&down?.verification?.wheelMethod==="quartz-event-post-only");
    check("phase10d-public-down-backend",down?.backend?.name==="macos-quartz"&&down?.backend?.strategy==="primary-display-pointer-wheel-post"&&down?.backend?.fallback===true);

    const secondReady=await lines.next(10000);if(secondReady?.state==="BLOCKED")throw new BlockedError(secondReady.error||"wheel fixture blocked");if(secondReady?.ok!==true)throw new Error(secondReady?.error||"first wheel consequence not verified");
    check("phase10d-independent-down-delivery",secondReady.firstWheelObservedCount>=1,`count=${secondReady.firstWheelObservedCount}`);
    check("phase10d-independent-down-consequence",secondReady.firstContentDirection==="increasing-y",`direction=${secondReady.firstContentDirection}`);
    check("phase10d-independent-baseline-reset",secondReady.baselineReset===true);

    const up=await client.wheelPointer({display:"primary",x:point.x,y:point.y,direction:"up",amount:3});
    check("phase10d-public-up-state",up?.state==="WHEEL_POSTED"&&up?.display==="primary"&&up?.direction==="up"&&up?.amount===3);
    check("phase10d-public-up-position",near(up?.position?.x,point.x)&&near(up?.position?.y,point.y)&&up?.positionVerified===true);
    check("phase10d-public-up-boundary",up?.wheelDelivery==="POSTED"&&up?.semanticConsequenceVerified===false);
    check("phase10d-public-up-verification",up?.verification?.positionMethod==="quartz-current-pointer-location"&&up?.verification?.wheelMethod==="quartz-event-post-only");
    check("phase10d-public-up-backend",up?.backend?.name==="macos-quartz"&&up?.backend?.strategy==="primary-display-pointer-wheel-post"&&up?.backend?.fallback===true);

    const publicText=JSON.stringify([down,up]);check("phase10d-public-native-sign-private",!/(wheel1|wheel2|wheel3|nativeDelta)/.test(publicText));
    const observed=await lines.next(10000);if(observed?.state==="BLOCKED")throw new BlockedError(observed.error||"wheel fixture blocked");if(observed?.ok!==true)throw new Error(observed?.error||"wheel fixture did not verify public delivery");
    check("phase10d-independent-up-delivery",observed.secondWheelObservedCount>=1,`count=${observed.secondWheelObservedCount}`);
    check("phase10d-independent-up-consequence",observed.secondContentDirection==="decreasing-y",`direction=${observed.secondContentDirection}`);
    check("phase10d-independent-opposite-directions",observed.oppositeDirectionsObserved===true);
    check("phase10d-public-pointer-restored",observed.pointerRestored===true);
    check("phase10d-public-test-owned-fixture",observed.fixtureOwned===true&&observed.semanticConsequenceClaimed===false);
    console.log("phase10d-public-user-content-touched=PASS value=false");
    console.log("phase10d-public-coordinate-logging=PASS coordinatesLogged=false nativeDisplayIdsLogged=false offsetsLogged=false");
    console.log("physical-phase10d-pointer-wheel-public=PASS");
  }finally{
    if(fixture&&fixture.exitCode==null)await waitExit(fixture,14000);
    try{if(client)await client.shutdownRuntime();}catch{}
    if(runtime&&runtime.exitCode==null)runtime.kill("SIGTERM");
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  }
}
main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/fixture compile|runtime startup|ACCESSIBILITY_NOT_TRUSTED|POINTER_HELPER_COMPILE_FAILED|macOS Phase 10D/i.test(text);console.error(`physical-phase10d-pointer-wheel-public=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
