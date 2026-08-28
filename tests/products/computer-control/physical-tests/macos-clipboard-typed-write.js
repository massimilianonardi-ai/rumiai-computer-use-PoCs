#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),readline=require("node:readline");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase9d2c-clipboard-typed-write.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));

class BlockedError extends Error {}
function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:32*1024*1024});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
function makeQueue(stream){
  const rl=readline.createInterface({input:stream,crlfDelay:Infinity});
  const values=[],waiters=[];
  let ended=false;
  rl.on("line",line=>{let value;try{value=JSON.parse(line);}catch{value={ok:false,state:"FAILED",error:"GUARDIAN_INVALID_JSON"};}if(waiters.length)waiters.shift().resolve(value);else values.push(value);});
  rl.on("close",()=>{ended=true;while(waiters.length)waiters.shift().reject(new Error("guardian stdout closed"));});
  return {next(timeoutMs=10000){if(values.length)return Promise.resolve(values.shift());if(ended)return Promise.reject(new Error("guardian stdout closed"));return new Promise((resolve,reject)=>{const waiter={resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}};const timer=setTimeout(()=>{const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);reject(new Error("guardian response timeout"));},timeoutMs);waiters.push(waiter);});},close(){rl.close();}};
}
function sendGuardian(child,command){child.stdin.write(`${JSON.stringify(command)}\n`);}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new BlockedError(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new BlockedError(`runtime exited before ready: ${code}; ${err}`));});});}
function buildGuardian(tmp){const source=path.resolve(__dirname,"helpers/macos-clipboard-restoration-guardian.swift"),binary=path.join(tmp,"clipboard-restoration-guardian");const c=run("/usr/bin/xcrun",["swiftc",source,"-o",binary,"-framework","AppKit"]);if(c.status!==0)throw new BlockedError(`clipboard guardian compile failed: ${c.stderr||c.stdout}`);return binary;}

const FIXTURES=[
  {format:"text/plain",bytes:Buffer.from("RumiAI Phase 9D2C typed write — plain text\n","utf8")},
  {format:"text/html",bytes:Buffer.from('<p data-rumiai="phase9d2c">RumiAI <strong>typed write</strong></p>',"utf8")},
  {format:"text/rtf",bytes:Buffer.from("{\\rtf1\\ansi RumiAI Phase 9D2C typed write}","utf8")},
  {format:"image/png",bytes:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64")},
];

async function main(){
  if(process.platform!=="darwin")throw new BlockedError("macOS typed clipboard write physical validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-clipboard-typed-write-"));
  let guardian=null,queue=null,runtime=null,client=null,guardianReady=false,restored=false,primaryError=null;
  try{
    const guardianBinary=buildGuardian(tmp);
    guardian=spawn(guardianBinary,[],{stdio:["pipe","pipe","pipe"]});
    queue=makeQueue(guardian.stdout);
    const ready=await queue.next();
    if(ready?.state==="BLOCKED")throw new BlockedError(ready.error||"clipboard backup unavailable");
    check("phase9d2c-guardian-ready",ready?.ok===true&&ready?.state==="READY"&&ready?.method==="independent-nspasteboard-general-restoration-guardian",JSON.stringify({itemCount:ready?.itemCount,typeCount:ready?.typeCount,byteCount:ready?.byteCount}));
    check("phase9d2c-guardian-backup-summary",Number.isInteger(ready.itemCount)&&ready.itemCount>=0&&Number.isInteger(ready.typeCount)&&ready.typeCount>=0&&Number.isInteger(ready.byteCount)&&ready.byteCount>=0,JSON.stringify({itemCount:ready.itemCount,typeCount:ready.typeCount,byteCount:ready.byteCount}));
    guardianReady=true;

    runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});
    await client.ensureReady();
    const info=await client.runtimeInfo();
    const observeCap=info.capabilities.find(value=>value.name==="clipboard.observe");
    const readCap=info.capabilities.find(value=>value.name==="clipboard.readFormat");
    const writeCap=info.capabilities.find(value=>value.name==="clipboard.writeFormat");
    check("phase9d2c-prior-metadata-validated",observeCap?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(observeCap));
    check("phase9d2c-prior-read-validated",readCap?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(readCap));
    check("phase9d2c-write-capability-implemented",writeCap?.validationState==="IMPLEMENTED",JSON.stringify(writeCap));
    check("phase9d2c-write-capability-strategy",writeCap?.strategies?.includes("os-owned-native-clipboard-typed-write")&&writeCap?.strategies?.includes("native-typed-readback-exact"),JSON.stringify(writeCap));
    for(const name of["clipboard.read","clipboard.write","clipboard.copy","clipboard.paste"]){const legacy=info.capabilities.find(value=>value.name===name);check(`phase9d2c-legacy-${name}-validated`,legacy?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(legacy));}

    for(const fixture of FIXTURES){
      const dataBase64=fixture.bytes.toString("base64");
      const written=await client.writeClipboardFormat({format:fixture.format,dataBase64});
      check(`phase9d2c-write-state-${fixture.format}`,written?.state==="WRITTEN"&&written?.verified===true&&written?.format===fixture.format,`format=${fixture.format}`);
      check(`phase9d2c-write-byte-count-${fixture.format}`,written?.byteCount===fixture.bytes.length,`format=${fixture.format} byteCount=${written?.byteCount}`);
      check(`phase9d2c-write-change-semantics-${fixture.format}`,written?.changed===true&&written?.idempotent===false,`format=${fixture.format}`);
      check(`phase9d2c-write-verification-${fixture.format}`,written?.verification?.method==="native-typed-readback-exact"&&written?.verification?.evidence?.revision===written.revision&&written?.verification?.evidence?.itemIndex===0&&written?.verification?.evidence?.format===fixture.format&&written?.verification?.evidence?.byteCount===fixture.bytes.length,`format=${fixture.format}`);
      check(`phase9d2c-write-backend-${fixture.format}`,written?.backend?.name==="macos-ax"&&written?.backend?.strategy==="os-owned-native-clipboard-typed-write"&&written?.backend?.fallback===false,`format=${fixture.format}`);
      check(`phase9d2c-write-result-no-payload-${fixture.format}`,!Object.prototype.hasOwnProperty.call(written,"dataBase64")&&!JSON.stringify(written).includes(dataBase64),`format=${fixture.format}`);

      sendGuardian(guardian,{command:"verify",format:fixture.format,dataBase64});
      const independent=await queue.next();
      check(`phase9d2c-independent-native-readback-${fixture.format}`,independent?.ok===true&&independent?.state==="VERIFIED"&&independent?.format===fixture.format&&independent?.byteCount===fixture.bytes.length&&independent?.itemCount===1,`format=${fixture.format}`);
      check(`phase9d2c-independent-revision-${fixture.format}`,independent?.revision===written.revision,`format=${fixture.format}`);

      const metadata=await client.observeClipboard();
      check(`phase9d2c-metadata-after-write-${fixture.format}`,metadata?.revision===written.revision&&metadata?.items?.length===1&&metadata.items[0]?.index===0&&metadata.items[0]?.formats?.includes(fixture.format),`format=${fixture.format}`);
      const read=await client.readClipboardFormat({revision:metadata.revision,itemIndex:0,format:fixture.format});
      check(`phase9d2c-public-readback-${fixture.format}`,read?.state==="READ"&&read?.byteCount===fixture.bytes.length&&Buffer.from(read.dataBase64,"base64").equals(fixture.bytes),`format=${fixture.format}`);
    }
    console.log("phase9d2c-all-canonical-formats-written=PASS count=4");
  }catch(error){primaryError=error;
  }finally{
    try{if(client)await client.shutdownRuntime();}catch(error){if(!primaryError)primaryError=error;}
    if(runtime&&runtime.exitCode==null)runtime.kill("SIGTERM");
    if(guardianReady&&guardian&&queue){
      try{
        sendGuardian(guardian,{command:"restore"});
        const restore=await queue.next(15000);
        restored=restore?.ok===true&&restore?.state==="RESTORED"&&restore?.method==="independent-nspasteboard-general-restoration-guardian";
        console.log(`phase9d2c-original-clipboard-restored=${restored?"PASS":"FAIL"}${restored?` itemCount=${restore.itemCount} typeCount=${restore.typeCount} byteCount=${restore.byteCount}`:""}`);
        if(!restored)primaryError=new Error(`original clipboard restoration failed: ${JSON.stringify({state:restore?.state,error:restore?.error})}`);
      }catch(error){primaryError=new Error(`original clipboard restoration failed: ${error.message}`);}
    }
    try{guardian?.stdin?.end();}catch(_){}
    if(guardian&&guardian.exitCode==null)guardian.kill("SIGTERM");
    try{queue?.close();}catch(_){}
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch(_){}
  }
  if(primaryError)throw primaryError;
  check("phase9d2c-restoration-required",restored===true);
  console.log("phase9d2c-payload-logging=PASS userPayload=false testPayload=false base64=false digest=false nativeTypeNames=false");
  console.log("physical-phase9d2c-clipboard-typed-write=PASS");
}

main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=error instanceof BlockedError||/xcrun|swiftc|permission|runtime startup|BACKEND_UNAVAILABLE|CLIPBOARD_RESTORATION_BACKUP_|CLIPBOARD_CHANGED_DURING_RESTORATION_BACKUP/i.test(text);console.error(`physical-phase9d2c-clipboard-typed-write=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
