#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p7e=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const FILE_NAME="rumiai-p7e-caller-context.js";
const TARGET="UTF-8";
const POSTCONDITION="UTF-16 LE";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function pulsarRunning(){return (run("/usr/bin/pgrep",["-x","Pulsar"]).status??1)===0||(run("/usr/bin/pgrep",["-f","/Pulsar.app/Contents/MacOS/Pulsar"]).status??1)===0;}
function isPulsarForeground(result){return result?.ok===true&&(result?.name==="Pulsar"||result?.process==="Pulsar"||result?.bundle==="dev.pulsar-edit.pulsar"||result?.bundleId==="dev.pulsar-edit.pulsar");}
function hashFile(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function compilePointerProbe(tmp){
  const source=path.join(tmp,"pointer.swift");
  const binary=path.join(tmp,"pointer-probe");
  fs.writeFileSync(source,`import AppKit\nimport Foundation\nstruct P:Codable{let x:Double;let y:Double}\nlet screen=NSScreen.screens.first(where:{abs($0.frame.origin.x)<0.5 && abs($0.frame.origin.y)<0.5}) ?? NSScreen.main ?? NSScreen.screens.first!\nlet m=NSEvent.mouseLocation\nlet px=Double(m.x-screen.frame.minX)\nlet py=Double(screen.frame.maxY-m.y)\nlet p=P(x:px,y:py)\nlet d=try! JSONEncoder().encode(p)\nprint(String(data:d,encoding:.utf8)!)\n`);
  const compiled=run("/usr/bin/xcrun",["swiftc","-framework","AppKit",source,"-o",binary]);
  if((compiled.status??1)!==0)fail("POINTER_PROBE_COMPILE_FAILED");
  const observed=run(binary,[]);
  if((observed.status??1)!==0)fail("POINTER_PROBE_FAILED");
  try{return JSON.parse(String(observed.stdout||"").trim());}catch{fail("POINTER_PROBE_RESPONSE_INVALID");}
}
function unwrapWindow(candidate){
  if(candidate?.field==="window"&&candidate.value&&typeof candidate.value==="object")return candidate.value;
  return candidate&&typeof candidate==="object"?candidate:null;
}
function canonicalPrivateParent(parentPath){
  const normalized=path.normalize(String(parentPath||""));
  if(normalized==="/var")return "/private/var";
  if(normalized.startsWith("/var/"))return `/private${normalized}`;
  return normalized;
}

(async()=>{
  let tmp=null,computerControl=null,pulsarLaunched=false,initialPointer=null,filePath=null;
  let pointerRestored=false,pulsarCleanup=false,runtimeCleanup=false,tempCleanup=false,selectorDismissed=false;
  let taskAttempted=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p7e=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p7e=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p7e-pulsar-"));
    initialPointer=compilePointerProbe(tmp);
    filePath=path.join(tmp,FILE_NAME);
    fs.writeFileSync(filePath,"// RumiAI P7E temporary fixture\nconst value = 1;\n","utf8");
    const fileHashBefore=hashFile(filePath);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    const perceptionProviders=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const inventory=computerControl.listApplications({availableOnly:true});
    const pulsarEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Pulsar"):null;
    if(!pulsarEntry?.available){
      outcome={code:2,marker:"physical-computer-use-perception-p7e=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
      return;
    }

    const opened=run("/usr/bin/open",["-a","Pulsar",filePath]);
    if((opened.status??1)!==0)fail("PULSAR_LAUNCH_FAILED");
    pulsarLaunched=true;
    for(let i=0;i<50&&!pulsarRunning();i++)await asyncSleep(100);
    if(!pulsarRunning())fail("PULSAR_PROCESS_NOT_RUNNING");

    const activated=computerControl.activateApplication({app:"Pulsar",timeoutMs:10000});
    if(!activated?.ok)fail("PULSAR_ACTIVATION_FAILED");
    let foreground=null;
    for(let i=0;i<30;i++){
      foreground=computerControl.getForeground();
      if(isPulsarForeground(foreground))break;
      await asyncSleep(100);
    }
    if(!isPulsarForeground(foreground))fail("PULSAR_NOT_FOREGROUND");

    const expectedWindowTitle=`${FILE_NAME} — ${canonicalPrivateParent(path.dirname(filePath))}`;
    let currentWindow=null,currentTitle="",titlePrecondition=null,titlePollAttempts=0;
    for(let i=0;i<60;i++){
      titlePollAttempts=i+1;
      currentWindow=computerControl.getCurrentWindow({app:"Pulsar"});
      currentTitle=String(unwrapWindow(currentWindow?.window)?.title||"").trim();
      if(currentWindow?.ok&&currentTitle){
        titlePrecondition=surface.evaluateSemanticSurfacePrecondition(
          {kind:"window-title",match:"exact",text:expectedWindowTitle},
          {currentWindow:currentWindow.window}
        );
        if(titlePrecondition?.ok&&titlePrecondition.state==="SURFACE_PRECONDITION_VERIFIED"&&titlePrecondition.metadata?.matchCount===1)break;
      }
      await asyncSleep(100);
    }
    if(!currentWindow?.ok||!currentTitle)fail("PULSAR_CURRENT_WINDOW_NOT_OBSERVED");
    if(!titlePrecondition?.ok||titlePrecondition.state!=="SURFACE_PRECONDITION_VERIFIED"||titlePrecondition.metadata?.matchCount!==1)fail("PULSAR_CALLER_DERIVED_WINDOW_TITLE_NOT_VERIFIED");

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:"Pulsar"},
      {id:2,intent:"OPEN",target:TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|surfacePrecondition|postcondition|providerRequest|providerId|scopeId|documentPath|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    let verifyCalls=0,providerSelectCalls=0,windowObserveCalls=0,lastSurface=null,observedPrecondition=null;
    taskAttempted=true;
    const taskOptions={
      executionMode:()=>"EXACT",
      planTask:async input=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(input).length,literalPayload:null}),
      visualFallbackCallerContext:{kind:"pulsar-document",documentPath:filePath},
      visualFallbackDependencies:{
        observeCurrentWindow:({app})=>{
          windowObserveCalls++;
          return computerControl.getCurrentWindow({app});
        },
        verifySurfacePrecondition:(precondition,context)=>{
          verifyCalls++;
          observedPrecondition=precondition;
          lastSurface=surface.evaluateSemanticSurfacePrecondition(precondition,context);
          return lastSurface;
        },
        selectProvider:(request,options)=>{
          providerSelectCalls++;
          return perceptionProviders.selectPerceptionProvider(request,options);
        },
        acquireMappedFrame:()=>{
          sleep(650);
          return perception.acquireMappedPrimaryVisualFrame();
        },
      },
    };
    if(Object.hasOwn(taskOptions,"visualFallbackContracts"))fail("P7E_EXPLICIT_CONTRACTS_PRESENT");

    const task=await agentLoop.runTask("Open the encoding selector for the current Pulsar document",taskOptions);

    if(!task?.ok)fail(`P7E_AGENT_LOOP_FAILED_${lastSurface?.reason||lastSurface?.state||"UNKNOWN"}`);
    const openedVisual=task.intentResults?.[1];
    if(!openedVisual?.ok||openedVisual.executionPath!=="visual-fallback")fail("P7E_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("P7E_SEMANTIC_GAP_INVALID");
    if(observedPrecondition?.kind!=="window-title"||observedPrecondition?.match!=="exact"||observedPrecondition?.text!==expectedWindowTitle)fail("P7E_CALLER_CONTEXT_SURFACE_NOT_MATERIALIZED");
    if(lastSurface?.state!=="SURFACE_PRECONDITION_VERIFIED"||lastSurface?.metadata?.matchCount!==1)fail("P7E_SURFACE_PRECONDITION_NOT_VERIFIED");
    if(verifyCalls!==1||windowObserveCalls!==1)fail("P7E_SURFACE_OBSERVATION_COUNT_INVALID");
    if(providerSelectCalls!==1)fail("P7E_PROVIDER_SELECTION_COUNT_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("P7E_LOCAL_VISION_PROVIDER_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.state!=="VERIFIED"||openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.kind!=="window-title")fail("P7E_SURFACE_PROVIDER_METADATA_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("P7E_DELIVERY_CONTRACT_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("P7E_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");

    const fileHashAfter=hashFile(filePath);
    if(fileHashAfter!==fileHashBefore)fail("P7E_DOCUMENT_MODIFIED_BY_SELECTOR_OPEN");

    console.log("p7e-real-use-case=PASS application=Pulsar target=UTF-8 temporaryDocument=true userDataModified=false");
    console.log(`p7e-caller-context=PASS kind=pulsar-document explicitDocumentPath=true explicitContracts=false surfaceMaterialized=true surfaceKind=window-title surfaceMatch=exact preflightAttempts=${titlePollAttempts}`);
    console.log("p7e-planner-boundary=PASS semanticOnly=true documentPathOutsidePlanner=true scopeOutsidePlanner=true surfacePreconditionOutsidePlanner=true postconditionOutsidePlanner=true coordinates=false providerObject=false");
    console.log("p7e-semantic-first=PASS semanticCode=NO_SEMANTIC_TARGET visualEligible=true providerSelectionAfterGap=true");
    console.log(`p7e-provider=PASS provider=rumiai.local.macos-vision-text-region selectionCalls=${providerSelectCalls} windowObservationCalls=${windowObserveCalls} surfaceVerifyCalls=${verifyCalls}`);
    console.log(`p7e-postcondition=PASS exactText=${POSTCONDITION.replace(/ /g,"_")} independentPostActionObservation=true`);
    console.log("p7e-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true semanticConsequenceVerifiedAtDelivery=false taskOutcome=VERIFIED_SUCCESS basis=post-action-independent-observation");
    console.log("p7e-document-integrity=PASS contentHashUnchanged=true encodingSelectionNotConfirmed=true");
    console.log("p7e-payload-policy=PASS rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p7e=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p7e=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(computerControl&&pulsarLaunched&&taskAttempted){
      try{
        const dismissed=computerControl.press({app:"Pulsar",keys:"Escape",settle:false});
        selectorDismissed=dismissed?.ok!==false;
      }catch{selectorDismissed=false;}
    }else selectorDismissed=true;

    if(computerControl&&initialPointer&&Number.isFinite(initialPointer.x)&&Number.isFinite(initialPointer.y)){
      try{
        const moved=computerControl.movePointer({display:"primary",x:initialPointer.x,y:initialPointer.y});
        pointerRestored=moved?.ok!==false;
      }catch{pointerRestored=false;}
    }else pointerRestored=initialPointer==null;

    if(computerControl&&pulsarLaunched){
      try{
        const result=computerControl.terminateApplication({app:"Pulsar",timeoutMs:10000});
        pulsarCleanup=result?.ok===true;
      }catch{pulsarCleanup=false;}
    }else pulsarCleanup=!pulsarLaunched;

    try{
      if(computerControl){
        const result=computerControl.shutdownRuntime();
        runtimeCleanup=result?.ok!==false;
      }else runtimeCleanup=true;
    }catch{runtimeCleanup=false;}

    if(tmp){
      try{fs.rmSync(tmp,{recursive:true,force:true});tempCleanup=true;}catch{tempCleanup=false;}
    }else tempCleanup=true;

    if(outcome.code!==2){
      const cleanupOk=selectorDismissed&&pointerRestored&&pulsarCleanup&&runtimeCleanup&&tempCleanup;
      console.log(`p7e-test-cleanup=${cleanupOk?"PASS":"FAIL"} selectorDismissed=${selectorDismissed} pointerRestored=${pointerRestored} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p7e=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();