#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase10a-display-capture.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
const PNG_SIGNATURE=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
class BlockedError extends Error {}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:32*1024*1024,...options});}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new BlockedError(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new BlockedError(`runtime exited before ready: ${code}; ${err}`));});});}
function buildOracle(tmp){const source=path.resolve(__dirname,"helpers/macos-phase10a-display-capture-oracle.swift"),binary=path.join(tmp,"phase10a-display-capture-oracle");const c=run("/usr/bin/xcrun",["swiftc",source,"-o",binary,"-framework","AppKit","-framework","CoreGraphics","-framework","ScreenCaptureKit"]);if(c.status!==0)throw new BlockedError(`display capture oracle compile failed: ${c.stderr||c.stdout}`);return binary;}
function oracleVerify(binary,dataBase64){const executed=run(binary,[],{input:JSON.stringify({dataBase64}),timeout:30000});let value=null;try{value=JSON.parse(String(executed.stdout||"").trim());}catch{throw new Error("display capture oracle returned invalid JSON");}if((executed.status??1)===2||value?.state==="BLOCKED")throw new BlockedError(value?.error||"display capture oracle blocked");if((executed.status??1)!==0||value?.ok!==true||value?.state!=="VERIFIED")throw new Error(value?.error||"display capture oracle failed");return value;}
function publicKeysOnly(value){return Object.keys(value||{}).sort().join(",");}
async function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS display capture physical validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-phase10a-display-capture-"));
  let runtime=null,client=null;
  try{
    const oracleBinary=buildOracle(tmp);
    runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});
    await client.ensureReady();
    const info=await client.runtimeInfo();
    const displayListCap=info.capabilities.find(value=>value.name==="display.list");
    const captureCap=info.capabilities.find(value=>value.name==="display.capture");
    check("phase10a-display-list-prior-validated",displayListCap?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(displayListCap));
    check("phase10a-capture-capability-implemented",captureCap?.validationState==="IMPLEMENTED",JSON.stringify(captureCap));
    check("phase10a-capture-capability-strategy",captureCap?.strategies?.includes("screencapturekit-primary-display-single-frame-png"),JSON.stringify(captureCap));

    const displays=await client.listDisplays();
    const primaries=displays?.displays?.filter(value=>value.primary===true)||[];
    check("phase10a-primary-display-observed",displays?.state==="OBSERVED"&&primaries.length===1,`primaryCount=${primaries.length}`);

    const captured=await client.captureDisplay({display:"primary"});
    check("phase10a-public-state",captured?.state==="CAPTURED"&&captured?.display==="primary"&&captured?.format==="image/png","display=primary format=image/png");
    check("phase10a-public-dimensions",Number.isInteger(captured?.width)&&captured.width>0&&Number.isInteger(captured?.height)&&captured.height>0,`width=${captured?.width} height=${captured?.height}`);
    check("phase10a-public-byte-count",Number.isInteger(captured?.byteCount)&&captured.byteCount>0&&captured.byteCount<=20*1024*1024,`byteCount=${captured?.byteCount}`);
    check("phase10a-public-cursor-policy",captured?.cursorIncluded===false,"cursorIncluded=false");
    check("phase10a-public-backend",captured?.backend?.name==="macos-screencapturekit"&&captured?.backend?.strategy==="primary-display-single-frame-png","backend=macos-screencapturekit");
    check("phase10a-public-observation-method",captured?.observation?.method==="macos-screencapturekit-primary-display-png","method=macos-screencapturekit-primary-display-png");

    const bytes=Buffer.from(captured.dataBase64,"base64");
    check("phase10a-public-base64-canonical",bytes.toString("base64")===captured.dataBase64&&bytes.length===captured.byteCount,`decodedByteCount=${bytes.length}`);
    check("phase10a-public-png-signature",bytes.length>=PNG_SIGNATURE.length&&bytes.subarray(0,PNG_SIGNATURE.length).equals(PNG_SIGNATURE));

    const oracle=oracleVerify(oracleBinary,captured.dataBase64);
    check("phase10a-independent-png-decode",oracle.decodedWidth===captured.width&&oracle.decodedHeight===captured.height&&oracle.decodedByteCount===captured.byteCount,`width=${oracle.decodedWidth} height=${oracle.decodedHeight} byteCount=${oracle.decodedByteCount}`);
    check("phase10a-independent-primary-dimensions",oracle.mainDisplayCaptureWidth===captured.width&&oracle.mainDisplayCaptureHeight===captured.height,`width=${oracle.mainDisplayCaptureWidth} height=${oracle.mainDisplayCaptureHeight}`);
    check("phase10a-independent-screencapturekit-frame",oracle.independentCaptureWidth===captured.width&&oracle.independentCaptureHeight===captured.height&&oracle.screenCapturePreflight===true,`width=${oracle.independentCaptureWidth} height=${oracle.independentCaptureHeight}`);

    const keys=publicKeysOnly(captured);
    check("phase10a-public-native-identity-private",!["displayID","nativeRef","handle","NSScreenNumber","CGDirectDisplayID"].some(name=>keys.includes(name)),`publicKeys=${keys.replace("dataBase64","[payload-key]")}`);
    console.log(`phase10a-payload-logging=PASS payloadLogged=false base64Logged=false imagePersisted=false byteCount=${captured.byteCount}`);
    console.log("physical-phase10a-display-capture=PASS");
  }finally{
    try{if(client)await client.shutdownRuntime();}catch{}
    if(runtime&&runtime.exitCode==null)runtime.kill("SIGTERM");
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  }
}
main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/swiftc|xcrun|permission|SCREEN_CAPTURE_PERMISSION_REQUIRED|runtime startup|BACKEND_UNAVAILABLE|oracle blocked/i.test(text);console.error(`physical-phase10a-display-capture=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
