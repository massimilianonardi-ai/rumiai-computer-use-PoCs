#!/usr/bin/env node
"use strict";
const crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-phase9d2b-clipboard-typed-read.sock";
const MAX_BYTES=16*1024*1024;
const FORMATS=["text/plain","text/html","text/rtf","image/png"];
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:32*1024*1024});}
function check(label,condition,details=""){console.log(`${label}=${condition?"PASS":"FAIL"}${details?` ${details}`:""}`);if(!condition)throw new Error(`${label}${details?`: ${details}`:""}`);}
async function waitForRuntime(child){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error(`runtime startup timeout: ${err}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{out+=c;if(out.includes('"event":"runtime.ready"')){clearTimeout(timer);resolve();}});child.stderr.on("data",c=>{err+=c;});child.once("exit",code=>{clearTimeout(timer);reject(new Error(`runtime exited before ready: ${code}; ${err}`));});});}
function buildOracle(tmp){const source=path.resolve(__dirname,"helpers/macos-clipboard-typed-read-oracle.swift"),binary=path.join(tmp,"clipboard-typed-read-oracle");const c=run("/usr/bin/xcrun",["swiftc",source,"-o",binary,"-framework","AppKit"]);if(c.status!==0)throw new Error(`typed clipboard oracle compile failed: ${c.stderr||c.stdout}`);return binary;}
function oracleRead(binary,{revision,itemIndex,format}){const r=run(binary,[String(revision),String(itemIndex),String(format)]);if(r.status===2)throw new Error("clipboard changed during physical validation: independent oracle observed stale revision");if(r.status!==0)throw new Error(`typed clipboard oracle failed: ${r.stderr||r.stdout}`);const value=JSON.parse(r.stdout.trim());if(value?.ok!==true)throw new Error(`typed clipboard oracle invalid: ${r.stdout}`);return value;}
function sha256(buffer){return crypto.createHash("sha256").update(buffer).digest("hex");}
async function expectCode(promise,code,label){try{await promise;throw new Error(`${label}: expected ${code}`);}catch(error){if(error?.code!==code)throw error;console.log(`${label}=PASS code=${code}`);}}
async function main(){
  if(process.platform!=="darwin")throw new Error("macOS typed clipboard physical validation required");
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-clipboard-typed-read-"));
  const oracleBinary=buildOracle(tmp);
  const runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});
  let client;
  try{
    await waitForRuntime(runtime);
    client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:30000});
    await client.ensureReady();
    const info=await client.runtimeInfo();
    const observedCap=info.capabilities.find(value=>value.name==="clipboard.observe");
    const readCap=info.capabilities.find(value=>value.name==="clipboard.readFormat");
    check("phase9d2b-prior-metadata-validated",observedCap?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(observedCap));
    check("phase9d2b-capability-implemented",readCap?.validationState==="IMPLEMENTED",JSON.stringify(readCap));
    check("phase9d2b-capability-strategy",readCap?.strategies?.includes("os-owned-native-clipboard-typed-read"),JSON.stringify(readCap));
    for(const name of["clipboard.read","clipboard.write","clipboard.copy","clipboard.paste"]){const legacy=info.capabilities.find(value=>value.name===name);check(`phase9d2b-legacy-${name}-validated`,legacy?.validationState==="PHYSICALLY_VALIDATED",JSON.stringify(legacy));}

    const metadata=await client.observeClipboard();
    check("phase9d2b-metadata-observed",metadata?.state==="OBSERVED"&&typeof metadata.revision==="string"&&Array.isArray(metadata.items),JSON.stringify({state:metadata?.state,itemCount:metadata?.items?.length}));
    const targets=[];
    for(const item of metadata.items)for(const format of item.formats||[])targets.push({revision:metadata.revision,itemIndex:item.index,format});
    if(targets.length===0)throw new Error("no canonical clipboard formats advertised for typed-read physical validation");
    console.log(`phase9d2b-advertised-target-count=${targets.length}`);

    for(const target of targets){
      const before=oracleRead(oracleBinary,target);
      check(`phase9d2b-oracle-before-${target.itemIndex}-${target.format}`,before.revision===target.revision&&before.itemIndex===target.itemIndex&&before.format===target.format&&Number.isInteger(before.byteCount)&&/^[0-9a-f]{64}$/.test(before.sha256),`format=${target.format}`);
      if(before.byteCount>MAX_BYTES){
        await expectCode(client.readClipboardFormat(target),"CLIPBOARD_PAYLOAD_TOO_LARGE",`phase9d2b-too-large-${target.itemIndex}-${target.format}`);
      }else{
        const read=await client.readClipboardFormat(target);
        check(`phase9d2b-read-state-${target.itemIndex}-${target.format}`,read?.state==="READ"&&read.revision===target.revision&&read.itemIndex===target.itemIndex&&read.format===target.format,`format=${target.format}`);
        const bytes=Buffer.from(read.dataBase64,"base64");
        check(`phase9d2b-canonical-base64-${target.itemIndex}-${target.format}`,bytes.toString("base64")===read.dataBase64,`format=${target.format}`);
        check(`phase9d2b-byte-count-${target.itemIndex}-${target.format}`,bytes.length===read.byteCount&&read.byteCount===before.byteCount,`format=${target.format}`);
        check(`phase9d2b-digest-match-${target.itemIndex}-${target.format}`,sha256(bytes)===before.sha256,`format=${target.format}`);
        check(`phase9d2b-method-${target.itemIndex}-${target.format}`,read?.observation?.method==="macos-native-clipboard-typed-read",`format=${target.format}`);
        check(`phase9d2b-backend-${target.itemIndex}-${target.format}`,read?.backend?.name==="macos-ax"&&read?.backend?.strategy==="os-owned-native-clipboard-typed-read",`format=${target.format}`);
      }
      const after=oracleRead(oracleBinary,target);
      check(`phase9d2b-oracle-after-${target.itemIndex}-${target.format}`,after.revision===before.revision&&after.byteCount===before.byteCount&&after.sha256===before.sha256,`format=${target.format}`);
    }

    await expectCode(client.readClipboardFormat({revision:`rumiai-stale-${metadata.revision}`,itemIndex:0,format:targets[0].format}),"CLIPBOARD_REVISION_STALE","phase9d2b-stale-revision-rejected");
    await expectCode(client.readClipboardFormat({revision:metadata.revision,itemIndex:metadata.items.length+100,format:targets[0].format}),"CLIPBOARD_ITEM_NOT_FOUND","phase9d2b-missing-item-rejected");
    const itemWithMissing=metadata.items.find(item=>FORMATS.some(format=>!item.formats.includes(format)));
    if(itemWithMissing){const missing=FORMATS.find(format=>!itemWithMissing.formats.includes(format));await expectCode(client.readClipboardFormat({revision:metadata.revision,itemIndex:itemWithMissing.index,format:missing}),"CLIPBOARD_FORMAT_NOT_AVAILABLE","phase9d2b-nonadvertised-format-rejected");}else console.log("phase9d2b-nonadvertised-format-rejected=SKIP all canonical formats advertised");

    const finalMetadata=await client.observeClipboard();
    if(finalMetadata.revision!==metadata.revision)throw new Error(`clipboard changed during physical validation: revision ${metadata.revision} -> ${finalMetadata.revision}`);
    check("phase9d2b-final-metadata-stable",JSON.stringify(finalMetadata.items)===JSON.stringify(metadata.items),JSON.stringify({itemCount:metadata.items.length}));
    console.log("physical-phase9d2b-clipboard-typed-read=PASS");
  }finally{
    try{if(client)await client.shutdownRuntime();}catch(_){}
    if(runtime.exitCode==null)runtime.kill("SIGTERM");
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch(_){}
  }
}
main().catch(error=>{const text=String(error?.stack||error?.message||error);const blocked=/xcrun|swiftc|CryptoKit|permission|runtime startup|BACKEND_UNAVAILABLE|clipboard changed during physical validation|no canonical clipboard formats advertised|typed clipboard oracle compile/i.test(text);console.error(`physical-phase9d2b-clipboard-typed-read=${blocked?"BLOCKED":"FAIL"}`);console.error(text);process.exit(blocked?2:1);});
