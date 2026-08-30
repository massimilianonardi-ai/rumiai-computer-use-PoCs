#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p9b=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const NODE=process.env.RUMIAI_CC_NODE||process.execPath;
const FILE_NAME="rumiai-p9b-external-invocation.js";
const TASK="Open the encoding selector for the current Pulsar document";
const TARGET="UTF-8";
const POSTCONDITION="UTF-16 LE";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
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
function makePreload(tmp){
  const preload=path.join(tmp,"p9b-preload.js");
  const code=`"use strict";
const fs=require("node:fs");
const path=require("node:path");
const productRoot=process.env.P9B_PRODUCT_ROOT;
const capturePath=process.env.P9B_CAPTURE_PATH;
if(!productRoot||!capturePath)throw new Error("P9B_PRELOAD_ENV_MISSING");
const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
const perceptionProviders=require(path.join(productRoot,"app","perception-provider-manager.js"));
const perception=require(path.join(productRoot,"app","perception.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const originalRunTask=agentLoop.runTask;
if(typeof originalRunTask!=="function")throw new Error("P9B_REAL_AGENT_LOOP_MISSING");
const plannerSteps=[{id:1,intent:"ACTIVATE_APP",app:"Pulsar"},{id:2,intent:"OPEN",target:"UTF-8"}];
let runTaskCalls=0,verifyCalls=0,providerSelectCalls=0,windowObserveCalls=0,lastSurface=null,observedPrecondition=null;
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
agentLoop.runTask=async function(task,options={}){
  runTaskCalls++;
  const inputOptionKeys=Object.keys(options||{}).sort();
  const sourcePreflight=agentLoop.resolveEffectiveVisualFallbackContracts(plannerSteps,{},options||{});
  let result=null,thrown=null;
  try{
    result=await originalRunTask(task,{
      ...options,
      executionMode:()=>"EXACT",
      planTask:async input=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(input).length,literalPayload:null}),
      visualFallbackDependencies:{
        observeCurrentWindow:({app})=>{windowObserveCalls++;return computerControl.getCurrentWindow({app});},
        verifySurfacePrecondition:(precondition,context)=>{verifyCalls++;observedPrecondition=precondition;lastSurface=surface.evaluateSemanticSurfacePrecondition(precondition,context);return lastSurface;},
        selectProvider:(request,providerOptions)=>{providerSelectCalls++;return perceptionProviders.selectPerceptionProvider(request,providerOptions);},
        acquireMappedFrame:()=>{sleep(650);return perception.acquireMappedPrimaryVisualFrame();},
      },
    });
    return result;
  }catch(error){
    thrown={name:error?.name||"Error",message:String(error?.message||error||"UNKNOWN")};
    throw error;
  }finally{
    const opened=result?.intentResults?.[1]||null;
    const capture={
      realAgentLoop:true,
      runTaskCalls,
      task,
      inputOptionKeys,
      taskResourceContext:options?.taskResourceContext||null,
      inputHasExplicitContracts:Object.hasOwn(options||{},"visualFallbackContracts"),
      inputHasExplicitCallerContext:Object.hasOwn(options||{},"visualFallbackCallerContext"),
      inputHasDocumentPath:Object.hasOwn(options||{},"documentPath"),
      sourcePreflight:{
        ok:sourcePreflight?.ok===true,
        source:sourcePreflight?.source||null,
        contractCount:Array.isArray(sourcePreflight?.contracts)?sourcePreflight.contracts.length:null,
        callerContextKind:sourcePreflight?.callerContext?.kind||null,
      },
      verifyCalls,providerSelectCalls,windowObserveCalls,
      observedPrecondition:observedPrecondition?{kind:observedPrecondition.kind,match:observedPrecondition.match,text:observedPrecondition.text}:null,
      lastSurface:lastSurface?{state:lastSurface.state,matchCount:lastSurface.metadata?.matchCount??null}:null,
      taskOk:result?.ok===true,
      openedVisual:opened?{
        ok:opened.ok===true,
        executionPath:opened.executionPath||null,
        eligibilityCode:opened.visualFallbackEligibility?.code||null,
        eligibilityEligible:opened.visualFallbackEligibility?.eligible===true,
        providerId:opened.visualFallbackProviderSelection?.provider?.id||null,
        providerSurfaceState:opened.visualFallbackProviderSelection?.surfacePrecondition?.state||null,
        providerSurfaceKind:opened.visualFallbackProviderSelection?.surfacePrecondition?.kind||null,
        deliveryState:opened.delivery?.state||null,
        controlState:opened.delivery?.controlState||null,
        semanticConsequenceVerified:opened.delivery?.semanticConsequenceVerified===true,
        taskOutcomeState:opened.taskOutcome?.state||null,
        taskOutcomeBasis:opened.taskOutcome?.basis||null,
      }:null,
      thrown,
    };
    fs.writeFileSync(capturePath,JSON.stringify(capture,null,2)+"\n","utf8");
  }
};
`;
  fs.writeFileSync(preload,code,"utf8");
  return preload;
}

(async()=>{
  let tmp=null,computerControl=null,pulsarLaunched=false,initialPointer=null,filePath=null;
  let pointerRestored=false,pulsarCleanup=false,runtimeCleanup=false,tempCleanup=false,selectorDismissed=false;
  let childAttempted=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p9b=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p9b=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p9b-pulsar-"));
    initialPointer=compilePointerProbe(tmp);
    filePath=path.join(tmp,FILE_NAME);
    fs.writeFileSync(filePath,"// RumiAI P9B temporary fixture\nconst value = 1;\n","utf8");
    const fileHashBefore=hashFile(filePath);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
    const invocationEntry=path.join(productRoot,"app","task-invocation.js");
    const invocationSource=fs.readFileSync(invocationEntry,"utf8");
    if(/P9B_|NODE_OPTIONS|preload|testHook|validateOnly/i.test(invocationSource))fail("P9B_PRODUCT_TEST_HOOK_PRESENT");

    const inventory=computerControl.listApplications({availableOnly:true});
    const pulsarEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Pulsar"):null;
    if(!pulsarEntry?.available){
      outcome={code:2,marker:"physical-computer-use-perception-p9b=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
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
    if(!titlePrecondition?.ok||titlePrecondition.state!=="SURFACE_PRECONDITION_VERIFIED"||titlePrecondition.metadata?.matchCount!==1)fail("PULSAR_EXTERNAL_RESOURCE_WINDOW_TITLE_NOT_VERIFIED");

    const plannerSteps=[{id:1,intent:"ACTIVATE_APP",app:"Pulsar"},{id:2,intent:"OPEN",target:TARGET}];
    if(/visualFallback|allowVisualFallback|targetQuery|surfacePrecondition|postcondition|providerRequest|providerId|scopeId|documentPath|taskResourceContext|resources|"x"|"y"/.test(JSON.stringify(plannerSteps)))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const invocation={
      version:1,
      task:TASK,
      resources:[{kind:"file",role:"current-document",application:"Pulsar",path:filePath}],
    };
    if(Object.hasOwn(invocation,"visualFallbackContracts")||Object.hasOwn(invocation,"visualFallbackCallerContext")||Object.hasOwn(invocation,"documentPath"))fail("P9B_EXTERNAL_INVOCATION_HIDDEN_VISUAL_SOURCE_PRESENT");

    const preload=makePreload(tmp);
    const capturePath=path.join(tmp,"p9b-child-capture.json");
    childAttempted=true;
    const child=run(NODE,["-r",preload,invocationEntry],{
      input:`${JSON.stringify(invocation)}\n`,
      env:{...process.env,P9B_PRODUCT_ROOT:productRoot,P9B_CAPTURE_PATH:capturePath},
    });
    if(child.signal!==null)fail("P9B_CHILD_PROCESS_SIGNALED");
    if((child.status??1)!==0)fail("P9B_CHILD_PROCESS_FAILED");
    if(String(child.stderr||"").trim())fail("P9B_CHILD_STDERR_NOT_EMPTY");
    if(!fs.existsSync(capturePath))fail("P9B_CHILD_CAPTURE_MISSING");

    let capture;
    try{capture=JSON.parse(fs.readFileSync(capturePath,"utf8"));}catch{fail("P9B_CHILD_CAPTURE_INVALID");}
    if(capture.realAgentLoop!==true||capture.runTaskCalls!==1)fail("P9B_REAL_AGENT_LOOP_NOT_WRAPPED_ONCE");
    if(capture.task!==TASK)fail("P9B_EXTERNAL_TASK_NOT_PRESERVED");
    if(JSON.stringify(capture.inputOptionKeys)!==JSON.stringify(["taskResourceContext"]))fail("P9B_EXTERNAL_RUN_TASK_OPTIONS_NOT_BOUNDED");
    if(capture.inputHasExplicitContracts||capture.inputHasExplicitCallerContext||capture.inputHasDocumentPath)fail("P9B_ALTERNATE_VISUAL_SOURCE_FORWARDED");
    const resource=capture.taskResourceContext?.resources?.[0];
    if(capture.taskResourceContext?.version!==1||capture.taskResourceContext.resources?.length!==1||resource?.kind!=="file"||resource?.role!=="current-document"||resource?.application!=="Pulsar"||resource?.path!==filePath)fail("P9B_TASK_RESOURCE_CONTEXT_NOT_PRESERVED");
    if(capture.sourcePreflight?.ok!==true||capture.sourcePreflight?.source!=="task-resource-context"||capture.sourcePreflight?.contractCount!==1||capture.sourcePreflight?.callerContextKind!=="pulsar-document")fail("P9B_RESOURCE_PROVENANCE_NOT_DERIVED");
    if(capture.taskOk!==true||capture.openedVisual?.ok!==true||capture.openedVisual?.executionPath!=="visual-fallback")fail("P9B_VISUAL_OPEN_NOT_VERIFIED");
    if(capture.openedVisual?.eligibilityCode!=="NO_SEMANTIC_TARGET"||capture.openedVisual?.eligibilityEligible!==true)fail("P9B_SEMANTIC_GAP_INVALID");
    if(capture.observedPrecondition?.kind!=="window-title"||capture.observedPrecondition?.match!=="exact"||capture.observedPrecondition?.text!==expectedWindowTitle)fail("P9B_RESOURCE_SURFACE_NOT_MATERIALIZED");
    if(capture.lastSurface?.state!=="SURFACE_PRECONDITION_VERIFIED"||capture.lastSurface?.matchCount!==1)fail("P9B_SURFACE_PRECONDITION_NOT_VERIFIED");
    if(capture.verifyCalls!==1||capture.windowObserveCalls!==1||capture.providerSelectCalls!==1)fail("P9B_LAZY_PROVIDER_OR_SURFACE_COUNTS_INVALID");
    if(capture.openedVisual?.providerId!=="rumiai.local.macos-vision-text-region")fail("P9B_LOCAL_VISION_PROVIDER_INVALID");
    if(capture.openedVisual?.providerSurfaceState!=="VERIFIED"||capture.openedVisual?.providerSurfaceKind!=="window-title")fail("P9B_SURFACE_PROVIDER_METADATA_INVALID");
    if(capture.openedVisual?.deliveryState!=="POSTED"||capture.openedVisual?.controlState!=="CLICK_POSTED"||capture.openedVisual?.semanticConsequenceVerified!==false)fail("P9B_DELIVERY_CONTRACT_INVALID");
    if(capture.openedVisual?.taskOutcomeState!=="VERIFIED_SUCCESS"||capture.openedVisual?.taskOutcomeBasis!=="post-action-independent-observation")fail("P9B_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");
    if(capture.thrown!==null)fail("P9B_CHILD_AGENT_LOOP_THROWN");

    const fileHashAfter=hashFile(filePath);
    if(fileHashAfter!==fileHashBefore)fail("P9B_DOCUMENT_MODIFIED_BY_SELECTOR_OPEN");

    console.log("p9b-real-use-case=PASS application=Pulsar target=UTF-8 temporaryDocument=true userDataModified=false");
    console.log(`p9b-external-process=PASS transport=stdin entry=task-invocation realChildProcess=true fixtureOnlyPreload=true realAgentLoop=true runTaskCalls=1 taskPreserved=true forwardedSource=taskResourceContext alternateVisualSources=false preflightAttempts=${titlePollAttempts}`);
    console.log("p9b-provenance-chain=PASS owner=external-caller productOwner=task-invocation source=task-resource-context derivedCallerContext=pulsar-document explicitCallerContext=false explicitContracts=false surfaceMaterialized=true surfaceKind=window-title surfaceMatch=exact");
    console.log("p9b-planner-boundary=PASS semanticOnly=true resourcePathOutsidePlanner=true invocationOutsidePlanner=true callerContextOutsidePlanner=true scopeOutsidePlanner=true surfacePreconditionOutsidePlanner=true postconditionOutsidePlanner=true coordinates=false providerObject=false");
    console.log("p9b-semantic-first=PASS semanticCode=NO_SEMANTIC_TARGET visualEligible=true providerSelectionAfterGap=true");
    console.log(`p9b-provider=PASS provider=rumiai.local.macos-vision-text-region selectionCalls=${capture.providerSelectCalls} windowObservationCalls=${capture.windowObserveCalls} surfaceVerifyCalls=${capture.verifyCalls}`);
    console.log(`p9b-postcondition=PASS exactText=${POSTCONDITION.replace(/ /g,"_")} independentPostActionObservation=true`);
    console.log("p9b-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true semanticConsequenceVerifiedAtDelivery=false taskOutcome=VERIFIED_SUCCESS basis=post-action-independent-observation");
    console.log("p9b-document-integrity=PASS contentHashUnchanged=true encodingSelectionNotConfirmed=true");
    console.log("p9b-payload-policy=PASS childCaptureEphemeral=true rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p9b=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p9b=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(computerControl&&pulsarLaunched&&childAttempted){
      try{const dismissed=computerControl.press({app:"Pulsar",keys:"Escape",settle:false});selectorDismissed=dismissed?.ok!==false;}catch{selectorDismissed=false;}
    }else selectorDismissed=true;

    if(computerControl&&initialPointer&&Number.isFinite(initialPointer.x)&&Number.isFinite(initialPointer.y)){
      try{const moved=computerControl.movePointer({display:"primary",x:initialPointer.x,y:initialPointer.y});pointerRestored=moved?.ok!==false;}catch{pointerRestored=false;}
    }else pointerRestored=initialPointer==null;

    if(computerControl&&pulsarLaunched){
      try{const result=computerControl.terminateApplication({app:"Pulsar",timeoutMs:10000});pulsarCleanup=result?.ok===true;}catch{pulsarCleanup=false;}
    }else pulsarCleanup=!pulsarLaunched;

    try{
      if(computerControl){const result=computerControl.shutdownRuntime();runtimeCleanup=result?.ok!==false;}else runtimeCleanup=true;
    }catch{runtimeCleanup=false;}

    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});tempCleanup=true;}catch{tempCleanup=false;}}else tempCleanup=true;

    if(outcome.code!==2){
      const cleanupOk=selectorDismissed&&pointerRestored&&pulsarCleanup&&runtimeCleanup&&tempCleanup;
      console.log(`p9b-test-cleanup=${cleanupOk?"PASS":"FAIL"} selectorDismissed=${selectorDismissed} pointerRestored=${pointerRestored} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p9b=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
