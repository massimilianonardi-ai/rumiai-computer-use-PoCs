#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const ROOT=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");
const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const SOCKET=process.env.RUMIAI_CC_SOCKET||"/tmp/rumiai-computer-control-value.sock";
const {ComputerControlClient}=require(path.join(ROOT,"sdk/typescript/src"));
function check(label,v){console.log(`${label}=${v?"PASS":"FAIL"}`);if(!v)throw new Error(label);}
function ready(child){return new Promise((resolve,reject)=>{let o="",e="";const t=setTimeout(()=>reject(new Error(`runtime startup timeout: ${e}`)),10000);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",c=>{o+=c;if(o.includes('"event":"runtime.ready"')){clearTimeout(t);resolve();}});child.stderr.on("data",c=>e+=c);child.once("exit",code=>{clearTimeout(t);reject(new Error(`runtime exited before ready: ${code}; ${e}`));});});}
async function main(){
 if(process.platform!=="darwin")throw new Error("macOS physical test required");
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-value-"));const fixture=path.join(dir,"value.html");
 fs.writeFileSync(fixture,`<!doctype html><html><body><label>RumiAI physical slider <input type="range" min="0" max="10" step="1" value="5" aria-label="RumiAI physical slider"></label></body></html>`,`utf8`);
 const runtime=spawn(NODE,[path.join(ROOT,"runtime/src/cli.js")],{cwd:ROOT,env:{...process.env,RUMIAI_CC_SOCKET:SOCKET},stdio:["ignore","pipe","pipe"]});let client;
 try{await ready(runtime);client=new ComputerControlClient({socketPath:SOCKET,timeoutMs:20000});await client.ensureReady();if(spawnSync("/usr/bin/open",["-a","Safari",fixture]).status!==0)throw new Error("could not open Safari fixture");await client.ensureApplicationReady({application:"Safari",timeoutMs:15000});
 const snap=await client.snapshot({application:"Safari",settle:true,compact:false});const slider=snap.nodes.find(n=>n.role==="slider"&&/RumiAI physical slider/i.test(n.name||""));check("slider-observed",Boolean(slider));
 const before=await client.describe({application:"Safari",target:slider});check("slider-numeric-value",typeof before.value==="number"&&Number.isFinite(before.value));
 const requested=before.value===7?6:7;const set=await client.setValue({application:"Safari",target:slider,value:requested});check("set-value-verified",set.verified===true&&Number(set.observedValue)===requested);
 const idem=await client.setValue({application:"Safari",target:set.target,value:requested});check("set-value-idempotent",idem.idempotent===true&&idem.changed===false);
 const inc=await client.increment({application:"Safari",target:idem.target});check("increment-direction",inc.verified===true&&Number(inc.observedValue)>Number(inc.previousValue));
 const dec=await client.decrement({application:"Safari",target:inc.target});check("decrement-direction",dec.verified===true&&Number(dec.observedValue)<Number(dec.previousValue));
 const restored=await client.setValue({application:"Safari",target:dec.target,value:before.value});check("value-restored",restored.verified===true&&Number(restored.observedValue)===Number(before.value));
 console.log("physical-native-control-value=PASS");
 }finally{try{if(client)await client.shutdownRuntime();}catch(_){}if(runtime.exitCode==null)runtime.kill("SIGTERM");try{spawnSync("/usr/bin/osascript",["-e",'tell application "Safari" to close front document']);}catch(_){}try{fs.unlinkSync(fixture);fs.rmdirSync(dir);}catch(_){}}
}
main().catch(e=>{console.error("physical-native-control-value=BLOCKED");console.error(e.stack||e.message);process.exit(1);});
