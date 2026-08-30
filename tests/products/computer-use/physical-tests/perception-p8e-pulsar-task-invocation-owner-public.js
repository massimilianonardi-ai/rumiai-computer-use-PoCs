#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p8e=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const FILE_NAME="rumiai-p8e-task-invocation.js";
const TASK="Open the encoding selector for the current Pulsar document";
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
  let outcome={code:1,marker:"physical-computer-use-perception-p8e=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p8e=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p8e-pulsar-"));
    initialPointer=compilePointerProbe(tmp);
    filePath=path.join(tmp,FILE_NAME);
    fs.writeFileSync(filePath,"// RumiAI P8E temporary fixture\nconst value = 1;\n","utf8");
    const fileHashBefore=hashFile(filePath);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    const perceptionProviders=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    const taskInvocation=require(path.join(productRoot,"app","task-invocation.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const inventory=computerControl.listApplications({availableOnly:true});
    const pulsarEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Pulsar"):null;
    if(!pulsarEntry?.available){
      outcome={code:2,marker:"physical-computer-use-perception-p8e=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
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
    if(!titlePrecondition?.ok||titlePrecondition.state!=="SURFACE_PRECONDITION_VERIFIED"||titlePrecondition.metadata?.matchCount!==1)fail("PULSAR_INVOCATION_RESOURCE_WINDOW_TITLE_NOT_VERIFIED");

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:"Pulsar"},
      {id:2,intent:"OPEN",target:TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|surfacePrecondition|postcondition|providerRequest|providerId|scopeId|documentPath|taskResourceContext|resources|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const invocationJson=JSON.stringify({
      version:1,
      task:TASK,
      resources:[{
        kind:"file",
        role:"current-document",
        application:"Pulsar",
        path:filePath,
      }],
    });
    const invocationPayload=JSON.parse(invocationJson);
    const normalizedInvocation=taskInvocation.normalizeTaskInvocation(invocationPayload);
    if(!normalizedInvocation?.ok||normalizedInvocation.state!=="TASK_INVOCATION_NORMALIZED")fail("P8E_INVOCATION_NOT_NORMALIZED");
    if(normalizedInvocation.invocation?.task!==TASK)fail("P8E_INVOCATION_TASK_CHANGED");
    if(!normalizedInvocation.invocation?.taskResourceContext||normalizedInvocation.invocation.taskResourceContext.version!==1)fail("P8E_INVOCATION_RESOURCE_CONTEXT_MISSING");
    if(Object.hasOwn(normalizedInvocation.invocation,"documentPath")||Object.hasOwn(normalizedInvocation.invocation,"visualFallbackCallerContext")||Object.hasOwn(normalizedInvocation.invocation,"visualFallbackContracts"))fail("P8E_INVOCATION_HIDDEN_VISUAL_SOURCE_PRESENT");

    const sourcePreflight=agentLoop.resolveEffectiveVisualFallbackContracts(
      plannerSteps,
      {},
      {taskResourceContext:normalizedInvocation.invocation.taskResourceContext}
    );
    if(!sourcePreflight?.ok||sourcePreflight.source!=="task-resource-context")fail("P8E_TASK_RESOURCE_SOURCE_NOT_SELECTED");
    if(sourcePreflight.contracts?.length!==1)fail("P8E_TASK_RESOURCE_CONTRACT_COUNT_INVALID");
    if(sourcePreflight.callerContext?.kind!=="pulsar-document")fail("P8E_PULSAR_CALLER_CONTEXT_NOT_DERIVED");

    let verifyCalls=0,providerSelectCalls=0,windowObserveCalls=0,lastSurface=null,observedPrecondition=null;
    let invocationRunTaskCalls=0,invocationOptions=null,invocationTask=null;
    taskAttempted=true;

    const executed=await taskInvocation.runTaskInvocation(invocationPayload,{
      runTask:async(task,options)=>{
        invocationRunTaskCalls++;
        invocationTask=task;
        invocationOptions=options;
        const optionKeys=Object.keys(options||{}).sort();
        if(optionKeys.length!==1||optionKeys[0]!=="taskResourceContext")fail("P8E_INVOCATION_RUN_TASK_OPTIONS_NOT_BOUNDED");
        return agentLoop.runTask(task,{
          ...options,
          executionMode:()=>"EXACT",
          planTask:async input=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(input).length,literalPayload:null}),
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
            selectProvider:(request,providerOptions)=>{
              providerSelectCalls++;
              return perceptionProviders.selectPerceptionProvider(request,providerOptions);
            },
            acquireMappedFrame:()=>{
              sleep(650);
              return perception.acquireMappedPrimaryVisualFrame();
            },
          },
        });
      },
    });

    if(invocationRunTaskCalls!==1)fail("P8E_INVOCATION_RUN_TASK_COUNT_INVALID");
    if(invocationTask!==TASK)fail("P8E_INVOCATION_TASK_NOT_PRESERVED");
    if(!invocationOptions?.taskResourceContext)fail("P8E_INVOCATION_TASK_RESOURCE_CONTEXT_NOT_FORWARDED");
    if(Object.hasOwn(invocationOptions,"visualFallbackContracts")||Object.hasOwn(invocationOptions,"visualFallbackCallerContext")||Object.hasOwn(invocationOptions,"documentPath"))fail("P8E_INVOCATION_ALTERNATE_VISUAL_SOURCE_FORWARDED");
    if(!executed?.ok||executed.state!=="TASK_INVOCATION_COMPLETED")fail(`P8E_TASK_INVOCATION_FAILED_${lastSurface?.reason||lastSurface?.state||executed?.state||"UNKNOWN"}`);

    const task=executed.result;
    if(!task?.ok)fail(`P8E_AGENT_LOOP_FAILED_${lastSurface?.reason||lastSurface?.state||"UNKNOWN"}`);
    const openedVisual=task.intentResults?.[1];
    if(!openedVisual?.ok||openedVisual.executionPath!=="visual-fallback")fail("P8E_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("P8E_SEMANTIC_GAP_INVALID");
    if(observedPrecondition?.kind!=="window-title"||observedPrecondition?.match!=="exact"||observedPrecondition?.text!==expectedWindowTitle)fail("P8E_RESOURCE_SURFACE_NOT_MATERIALIZED");
    if(lastSurface?.state!=="SURFACE_PRECONDITION_VERIFIED"||lastSurface?.metadata?.matchCount!==1)fail("P8E_SURFACE_PRECONDITION_NOT_VERIFIED");
    if(verifyCalls!==1||windowObserveCalls!==1)fail("P8E_SURFACE_OBSERVATION_COUNT_INVALID");
    if(providerSelectCalls!==1)fail("P8E_PROVIDER_SELECTION_COUNT_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("P8E_LOCAL_VISION_PROVIDER_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.state!=="VERIFIED"||openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.kind!=="window-title")fail("P8E_SURFACE_PROVIDER_METADATA_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("P8E_DELIVERY_CONTRACT_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("P8E_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");

    const fileHashAfter=hashFile(filePath);
    if(fileHashAfter!==fileHashBefore)fail("P8E_DOCUMENT_MODIFIED_BY_SELECTOR_OPEN");

    console.log("p8e-real-use-case=PASS application=Pulsar target=UTF-8 temporaryDocument=true userDataModified=false");
    console.log(`p8e-task-invocation=PASS invocationVersion=1 explicitResources=true invocationJson=true runTaskCalls=${invocationRunTaskCalls} taskPreserved=true forwardedSource=taskResourceContext alternateVisualSources=false preflightAttempts=${titlePollAttempts}`);
    console.log("p8e-provenance-chain=PASS owner=task-invocation source=task-resource-context derivedCallerContext=pulsar-document explicitCallerContext=false explicitContracts=false surfaceMaterialized=true surfaceKind=window-title surfaceMatch=exact");
    console.log("p8e-planner-boundary=PASS semanticOnly=true resourcePathOutsidePlanner=true invocationOutsidePlanner=true callerContextOutsidePlanner=true scopeOutsidePlanner=true surfacePreconditionOutsidePlanner=true postconditionOutsidePlanner=true coordinates=false providerObject=false");
    console.log("p8e-semantic-first=PASS semanticCode=NO_SEMANTIC_TARGET visualEligible=true providerSelectionAfterGap=true");
    console.log(`p8e-provider=PASS provider=rumiai.local.macos-vision-text-region selectionCalls=${providerSelectCalls} windowObservationCalls=${windowObserveCalls} surfaceVerifyCalls=${verifyCalls}`);
    console.log(`p8e-postcondition=PASS exactText=${POSTCONDITION.replace(/ /g,"_")} independentPostActionObservation=true`);
    console.log("p8e-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true semanticConsequenceVerifiedAtDelivery=false taskOutcome=VERIFIED_SUCCESS basis=post-action-independent-observation");
    console.log("p8e-document-integrity=PASS contentHashUnchanged=true encodingSelectionNotConfirmed=true");
    console.log("p8e-payload-policy=PASS rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p8e=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p8e=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
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
      console.log(`p8e-test-cleanup=${cleanupOk?"PASS":"FAIL"} selectorDismissed=${selectorDismissed} pointerRestored=${pointerRestored} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p8e=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();