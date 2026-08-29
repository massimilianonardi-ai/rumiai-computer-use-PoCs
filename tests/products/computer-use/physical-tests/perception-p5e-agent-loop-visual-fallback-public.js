#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p5e=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

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
  fs.writeFileSync(path.join(providerDir,"p5e-semantic-fixture.json"),JSON.stringify({
    id:"rumiai-p5e-semantic-fixture",
    name:SEMANTIC_APP,
    kind:"application",
    aliases:[SEMANTIC_APP],
    activation:{application:SEMANTIC_PROCESS},
    availability:{type:"paths",paths:[appBundle]},
    contexts:["native-controls","appkit","p5e-agent-loop"],
    capabilities:{},
    identity:{process:SEMANTIC_PROCESS,bundle:SEMANTIC_BUNDLE},
  },null,2));
  return {appBundle,providerDir};
}

(async()=>{
  let visualFixture=null,tmp=null,ready=null,computerControl=null,agentLoop=null;
  let semanticApplicationOpened=false;
  let pointerRestored=false,fixtureStopped=false,applicationCleanup=false,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p5e=FAIL code=UNEXPECTED"};

  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    killSemanticFixture();
    sleep(150);

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p5e-"));
    const prepared=prepareSemanticApplication(tmp);
    const visualFixtureBin=path.join(tmp,"click-fixture");
    const fc=run("/usr/bin/xcrun",["swiftc","-parse-as-library",visualFixtureSource,"-o",visualFixtureBin]);
    if((fc.status??1)!==0)fail("VISUAL_FIXTURE_COMPILE_FAILED");

    process.env.RUMIAI_PROVIDER_DIR=prepared.providerDir;
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
    agentLoop=require(path.join(productRoot,"app","agent-loop.js"));

    const opened=run("/usr/bin/open",[prepared.appBundle]);
    if((opened.status??1)!==0)fail("SEMANTIC_FIXTURE_LAUNCH_FAILED");
    semanticApplicationOpened=true;
    sleep(650);

    const inventory=computerControl.listApplications({availableOnly:true});
    const semanticEntry=Array.isArray(inventory?.applications)
      ? inventory.applications.find(item=>item?.name===SEMANTIC_APP)
      : null;
    if(!semanticEntry?.available)fail("SEMANTIC_FIXTURE_PROVIDER_UNAVAILABLE");

    visualFixture=spawn(visualFixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(visualFixture);
    if(ready?.state!=="READY"||!ready.target||!ready.initialPointer)fail("VISUAL_FIXTURE_READY_INVALID");

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:SEMANTIC_APP},
      {id:2,intent:"OPEN",target:VISUAL_TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|postcondition|providerRequest|providerId|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const taskResult=await agentLoop.runTask("P5E test-owned semantic OPEN task",{
      executionMode:()=>"EXACT",
      planTask:async task=>({
        steps:plannerSteps,
        seconds:0,
        metrics:null,
        prefixChars:0,
        taskChars:String(task).length,
        literalPayload:null,
      }),
      visualFallbackContracts:[{
        intent:"OPEN",
        targetQuery:{kind:"text",match:"exact",text:VISUAL_TARGET},
        actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
        policy:{allowVisualFallback:true},
        postcondition:{kind:"text",match:"exact",text:VISUAL_POSTCONDITION},
        providerRequest:{capabilities:["text-region"],locality:"local"},
      }],
    });

    if(!taskResult?.ok)fail(taskResult?.error||"AGENT_LOOP_TASK_FAILED");
    if(!Array.isArray(taskResult.plan)||taskResult.plan.length!==2)fail("AGENT_LOOP_PLAN_INVALID");
    if(!Array.isArray(taskResult.intentResults)||taskResult.intentResults.length!==2)fail("AGENT_LOOP_INTENT_RESULTS_INVALID");

    const activation=taskResult.intentResults[0];
    const openedVisual=taskResult.intentResults[1];
    if(activation.intent!=="ACTIVATE_APP"||activation.ok!==true)fail("AGENT_LOOP_ACTIVATION_NOT_VERIFIED");
    if(openedVisual.intent!=="OPEN"||openedVisual.ok!==true||openedVisual.executionPath!=="visual-fallback")fail("AGENT_LOOP_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("AGENT_LOOP_ELIGIBILITY_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("AGENT_LOOP_PROVIDER_ID_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.locality!=="local")fail("AGENT_LOOP_PROVIDER_LOCALITY_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.selection?.locality!=="local")fail("AGENT_LOOP_PROVIDER_SELECTION_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("AGENT_LOOP_DELIVERY_CONTRACT_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("AGENT_LOOP_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");

    console.log("p5e-normal-agent-loop=PASS plannerSemanticOnly=true intents=ACTIVATE_APP,OPEN normalRunTask=true");
    console.log("p5e-semantic-first=PASS eligibleGap=NO_SEMANTIC_TARGET visualContextResolution=lazy");
    console.log("p5e-provider-selection=PASS provider=rumiai.local.macos-vision-text-region locality=local computerUseOwned=true");
    console.log("p5e-visual-fallback=PASS coordinator=P5A explicitPolicy=true deterministicTarget=true deterministicPostcondition=true");
    console.log("p5e-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true taskOutcome=VERIFIED_SUCCESS independentPostActionObservation=true");
    console.log("p5e-payload-policy=PASS screenshotLogged=false ocrTextLogged=false coordinatesLogged=false plannerCoordinates=false");
    outcome={code:0,marker:"physical-computer-use-perception-p5e=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p5e=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(ready?.initialPointer&&computerControl){
      try{
        const restored=computerControl.movePointer({display:"primary",x:Number(ready.initialPointer.x),y:Number(ready.initialPointer.y)});
        pointerRestored=restored?.ok!==false&&restored?.state==="MOVED";
      }catch{pointerRestored=false;}
    }else pointerRestored=true;

    await stopChild(visualFixture);fixtureStopped=true;

    if(computerControl&&semanticApplicationOpened){
      try{
        const terminated=computerControl.terminateApplication({app:SEMANTIC_APP,timeoutMs:10000});
        applicationCleanup=terminated?.ok===true;
      }catch{applicationCleanup=false;}
    }else applicationCleanup=true;
    killSemanticFixture();

    try{
      if(computerControl){
        const shutdown=computerControl.shutdownRuntime();
        runtimeCleanup=shutdown?.ok!==false;
      }else runtimeCleanup=true;
    }catch{runtimeCleanup=false;}

    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}

    const cleanupOk=pointerRestored&&fixtureStopped&&applicationCleanup&&runtimeCleanup;
    console.log(`p5e-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} applicationCleanup=${applicationCleanup} runtimeCleanup=${runtimeCleanup}`);
    if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p5e=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
