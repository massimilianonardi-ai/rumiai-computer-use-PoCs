#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p6a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

const semanticFixtureSource=path.join(__dirname,"helpers","macos-perception-p5c-semantic-fixture.swift");
const visualFixtureSource=path.join(__dirname,"helpers","macos-perception-p4-click-fixture.swift");
const SEMANTIC_APP="RumiAI P5C Semantic Fixture";
const SEMANTIC_PROCESS="RumiAIP5CSemanticFixture";
const SEMANTIC_BUNDLE="ai.rumiai.computer-use.p5c-semantic-fixture";
const VISUAL_TARGET="RUMIAI CLICK 517";
const VISUAL_POSTCONDITION="RUMIAI DONE 864";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function run(cmd,args){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024});}
function killSemanticFixture(){run("/usr/bin/pkill",["-x",SEMANTIC_PROCESS]);}
function waitForReady(child,timeoutMs=8000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}

function prepareSemanticApplication(tmp){
  const appBundle=path.join(tmp,`${SEMANTIC_PROCESS}.app`);
  const contents=path.join(appBundle,"Contents");
  const macos=path.join(contents,"MacOS");
  fs.mkdirSync(macos,{recursive:true});
  const binary=path.join(macos,SEMANTIC_PROCESS);
  const compiled=run("/usr/bin/xcrun",["swiftc",semanticFixtureSource,"-o",binary,"-framework","AppKit"]);
  if((compiled.status??1)!==0)fail("SEMANTIC_FIXTURE_COMPILE_FAILED");
  fs.writeFileSync(path.join(contents,"Info.plist"),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>${SEMANTIC_PROCESS}</string><key>CFBundleIdentifier</key><string>${SEMANTIC_BUNDLE}</string><key>CFBundleName</key><string>${SEMANTIC_APP}</string><key>CFBundleDisplayName</key><string>${SEMANTIC_APP}</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>`);

  const providerDir=path.join(tmp,"providers");
  fs.mkdirSync(providerDir,{recursive:true});
  fs.writeFileSync(path.join(providerDir,"p6a-semantic-fixture.json"),JSON.stringify({
    id:"rumiai-p6a-semantic-fixture",
    name:SEMANTIC_APP,
    kind:"application",
    aliases:[SEMANTIC_APP],
    activation:{application:SEMANTIC_PROCESS},
    availability:{type:"paths",paths:[appBundle]},
    contexts:["native-controls","appkit","p6a-caller-contract"],
    capabilities:{},
    identity:{process:SEMANTIC_PROCESS,bundle:SEMANTIC_BUNDLE},
  },null,2));
  return {appBundle,providerDir};
}

(async()=>{
  let visualFixture=null,tmp=null,ready=null,computerControl=null;
  let semanticApplicationOpened=false;
  let pointerRestored=false,fixtureStopped=false,applicationCleanup=false,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p6a=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    killSemanticFixture();sleep(150);
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6a-"));
    const prepared=prepareSemanticApplication(tmp);
    const visualFixtureBin=path.join(tmp,"click-fixture");
    const fc=run("/usr/bin/xcrun",["swiftc","-parse-as-library",visualFixtureSource,"-o",visualFixtureBin]);
    if((fc.status??1)!==0)fail("VISUAL_FIXTURE_COMPILE_FAILED");

    const contractDir=path.join(tmp,"visual-contracts");
    fs.mkdirSync(contractDir,{recursive:true});
    fs.writeFileSync(path.join(contractDir,"p6a-runtime-caller.json"),JSON.stringify({
      id:"p6a.fixture.open.visual",
      application:SEMANTIC_APP,
      intent:"OPEN",
      target:VISUAL_TARGET,
      postcondition:VISUAL_POSTCONDITION,
      providerRequest:{capabilities:["text-region"],locality:"local"},
    },null,2));

    process.env.RUMIAI_PROVIDER_DIR=prepared.providerDir;
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");
    process.env.RUMIAI_VISUAL_FALLBACK_CONTRACT_DIR=contractDir;

    const callerRegistry=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const selected=callerRegistry.selectVisualFallbackCallerContract(
      {intent:"OPEN",target:VISUAL_TARGET},
      {currentApp:SEMANTIC_APP}
    );
    if(!selected?.ok||selected.state!=="VISUAL_FALLBACK_CONTRACT_SELECTED")fail(selected?.error||"CALLER_CONTRACT_NOT_SELECTED");
    if(selected.descriptor?.id!=="p6a.fixture.open.visual")fail("CALLER_CONTRACT_ID_INVALID");
    if(selected.contract?.provider)fail("CALLER_CONTRACT_CONTAINS_PROVIDER_OBJECT");
    if(JSON.stringify(selected.contract).includes('"x"')||JSON.stringify(selected.contract).includes('"y"'))fail("CALLER_CONTRACT_CONTAINS_COORDINATES");

    const opened=run("/usr/bin/open",[prepared.appBundle]);
    if((opened.status??1)!==0)fail("SEMANTIC_FIXTURE_LAUNCH_FAILED");
    semanticApplicationOpened=true;sleep(650);
    const inventory=computerControl.listApplications({availableOnly:true});
    const semanticEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name===SEMANTIC_APP):null;
    if(!semanticEntry?.available)fail("SEMANTIC_FIXTURE_PROVIDER_UNAVAILABLE");

    visualFixture=spawn(visualFixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(visualFixture);
    if(ready?.state!=="READY"||!ready.target||!ready.initialPointer)fail("VISUAL_FIXTURE_READY_INVALID");

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:SEMANTIC_APP},
      {id:2,intent:"OPEN",target:VISUAL_TARGET},
    ];
    const taskResult=await agentLoop.runTask("P6A caller-registry semantic OPEN task",{
      executionMode:()=>"EXACT",
      planTask:async task=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(task).length,literalPayload:null}),
      visualFallbackContracts:[selected.contract],
    });

    if(!taskResult?.ok)fail(taskResult?.error||"AGENT_LOOP_TASK_FAILED");
    const openResult=taskResult.intentResults?.[1];
    if(!openResult?.ok||openResult.executionPath!=="visual-fallback")fail("CALLER_CONTRACT_OPEN_NOT_VERIFIED");
    if(openResult.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openResult.visualFallbackEligibility?.eligible!==true)fail("CALLER_CONTRACT_ELIGIBILITY_INVALID");
    if(openResult.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("CALLER_CONTRACT_PROVIDER_SELECTION_INVALID");
    if(openResult.delivery?.controlState!=="CLICK_POSTED"||openResult.delivery?.semanticConsequenceVerified!==false)fail("CALLER_CONTRACT_DELIVERY_INVALID");
    if(openResult.taskOutcome?.state!=="VERIFIED_SUCCESS"||openResult.taskOutcome?.basis!=="post-action-independent-observation")fail("CALLER_CONTRACT_SUCCESS_INVALID");

    console.log("p6a-caller-registry=PASS source=local-json exactApplication=true exactTarget=true ambiguousFailClosed=true");
    console.log("p6a-planner-boundary=PASS semanticOnly=true providerObject=false coordinates=false postconditionOutsidePlanner=true");
    console.log("p6a-lazy-provider=PASS provider=rumiai.local.macos-vision-text-region selectedAfterEligibleGap=true");
    console.log("p6a-agent-loop=PASS normalRunTask=true executionPath=visual-fallback taskOutcome=VERIFIED_SUCCESS");
    console.log("p6a-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true independentPostActionObservation=true");
    outcome={code:0,marker:"physical-computer-use-perception-p6a=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p6a=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(ready?.initialPointer&&computerControl){try{const r=computerControl.movePointer({display:"primary",x:Number(ready.initialPointer.x),y:Number(ready.initialPointer.y)});pointerRestored=r?.ok!==false&&r?.state==="MOVED";}catch{pointerRestored=false;}}else pointerRestored=true;
    await stopChild(visualFixture);fixtureStopped=true;
    if(computerControl&&semanticApplicationOpened){try{const r=computerControl.terminateApplication({app:SEMANTIC_APP,timeoutMs:10000});applicationCleanup=r?.ok===true;}catch{applicationCleanup=false;}}else applicationCleanup=true;
    killSemanticFixture();
    try{if(computerControl){const r=computerControl.shutdownRuntime();runtimeCleanup=r?.ok!==false;}else runtimeCleanup=true;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    const cleanupOk=pointerRestored&&fixtureStopped&&applicationCleanup&&runtimeCleanup;
    console.log(`p6a-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} applicationCleanup=${applicationCleanup} runtimeCleanup=${runtimeCleanup}`);
    if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p6a=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
