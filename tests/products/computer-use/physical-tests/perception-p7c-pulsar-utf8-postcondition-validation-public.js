#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p7c=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const FILE_NAME="rumiai-p7c-encoding-postcondition.js";
const TARGET="UTF-8";
const POSTCONDITION="UTF-16 LE";
const SCOPE_ID="p7.pulsar.encoding-selector.temporary-document.v1";
const CONTRACT_ID="p7.pulsar.encoding-selector.open";

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

(async()=>{
  let tmp=null,computerControl=null,pulsarLaunched=false,initialPointer=null,filePath=null;
  let pointerRestored=false,pulsarCleanup=false,runtimeCleanup=false,tempCleanup=false,selectorDismissed=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p7c=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p7c=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p7c-pulsar-"));
    initialPointer=compilePointerProbe(tmp);
    filePath=path.join(tmp,FILE_NAME);
    fs.writeFileSync(filePath,"// RumiAI P7C temporary fixture\nconst value = 1;\n","utf8");
    const fileHashBefore=hashFile(filePath);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const callerRegistry=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));
    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    const perceptionProviders=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const inventory=computerControl.listApplications({availableOnly:true});
    const pulsarEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Pulsar"):null;
    if(!pulsarEntry?.available){
      outcome={code:2,marker:"physical-computer-use-perception-p7c=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
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

    let currentWindow=null,currentTitle="";
    for(let i=0;i<40;i++){
      currentWindow=computerControl.getCurrentWindow({app:"Pulsar"});
      currentTitle=String(unwrapWindow(currentWindow?.window)?.title||"").trim();
      if(currentWindow?.ok&&currentTitle)break;
      await asyncSleep(100);
    }
    if(!currentWindow?.ok||!currentTitle)fail("PULSAR_CURRENT_WINDOW_NOT_OBSERVED");

    const parentPath=path.dirname(filePath);
    const expectedWindowTitle=`${FILE_NAME} — /private${parentPath}`;
    const titlePrecondition=surface.evaluateSemanticSurfacePrecondition(
      {kind:"window-title",match:"exact",text:expectedWindowTitle},
      {currentWindow:currentWindow.window}
    );
    if(!titlePrecondition?.ok||titlePrecondition.state!=="SURFACE_PRECONDITION_VERIFIED"||titlePrecondition.metadata?.matchCount!==1)fail("PULSAR_CALLER_DERIVED_WINDOW_TITLE_NOT_VERIFIED");

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:"Pulsar"},
      {id:2,intent:"OPEN",target:TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|surfacePrecondition|postcondition|providerRequest|providerId|scopeId|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const rawCallerContract={
      id:CONTRACT_ID,
      scopeId:SCOPE_ID,
      application:"Pulsar",
      intent:"OPEN",
      target:TARGET,
      postcondition:POSTCONDITION,
      surfacePrecondition:{kind:"window-title",match:"exact",text:expectedWindowTitle},
      providerRequest:{capabilities:["text-region"],locality:"local"},
    };
    const selected=callerRegistry.selectScopedVisualFallbackContractsForPlan(plannerSteps,{
      scopeId:SCOPE_ID,
      contracts:[rawCallerContract],
    });
    if(!selected?.ok||selected.state!=="VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED"||selected.contracts?.length!==1)fail(selected?.error||"P7C_SCOPED_CONTRACT_NOT_SELECTED");
    const materialized=selected.contracts[0];
    if(materialized?.surfacePrecondition?.kind!=="window-title"||materialized?.surfacePrecondition?.text!==expectedWindowTitle)fail("P7C_WINDOW_TITLE_PRECONDITION_NOT_MATERIALIZED");
    if(materialized?.postcondition?.text!==POSTCONDITION)fail("P7C_POSTCONDITION_NOT_MATERIALIZED");

    let verifyCalls=0,providerSelectCalls=0,windowObserveCalls=0,lastSurface=null;
    const task=await agentLoop.runTask("Open the encoding selector for the current Pulsar document",{
      executionMode:()=>"EXACT",
      planTask:async input=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(input).length,literalPayload:null}),
      visualFallbackContracts:selected.contracts,
      visualFallbackDependencies:{
        observeCurrentWindow:({app})=>{
          windowObserveCalls++;
          return computerControl.getCurrentWindow({app});
        },
        verifySurfacePrecondition:(precondition,context)=>{
          verifyCalls++;
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
    });

    if(!task?.ok)fail(`P7C_AGENT_LOOP_FAILED_${lastSurface?.reason||lastSurface?.state||"UNKNOWN"}`);
    const openedVisual=task.intentResults?.[1];
    if(!openedVisual?.ok||openedVisual.executionPath!=="visual-fallback")fail("P7C_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("P7C_SEMANTIC_GAP_INVALID");
    if(lastSurface?.state!=="SURFACE_PRECONDITION_VERIFIED"||lastSurface?.metadata?.matchCount!==1)fail("P7C_SURFACE_PRECONDITION_NOT_VERIFIED");
    if(verifyCalls!==1||windowObserveCalls!==1)fail("P7C_SURFACE_OBSERVATION_COUNT_INVALID");
    if(providerSelectCalls!==1)fail("P7C_PROVIDER_SELECTION_COUNT_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("P7C_LOCAL_VISION_PROVIDER_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.state!=="VERIFIED"||openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.kind!=="window-title")fail("P7C_SURFACE_PROVIDER_METADATA_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("P7C_DELIVERY_CONTRACT_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("P7C_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");

    const fileHashAfter=hashFile(filePath);
    if(fileHashAfter!==fileHashBefore)fail("P7C_DOCUMENT_MODIFIED_BY_SELECTOR_OPEN");

    console.log("p7c-real-use-case=PASS application=Pulsar target=UTF-8 temporaryDocument=true userDataModified=false");
    console.log("p7c-surface-identity=PASS kind=window-title match=exact callerDerivable=true template=FILE_NAME+PRIVATE_PARENT_PATH matchCount=1");
    console.log("p7c-planner-boundary=PASS semanticOnly=true scopeOutsidePlanner=true surfacePreconditionOutsidePlanner=true postconditionOutsidePlanner=true coordinates=false providerObject=false");
    console.log("p7c-semantic-first=PASS semanticCode=NO_SEMANTIC_TARGET visualEligible=true providerSelectionAfterGap=true");
    console.log(`p7c-provider=PASS provider=rumiai.local.macos-vision-text-region selectionCalls=${providerSelectCalls} windowObservationCalls=${windowObserveCalls} surfaceVerifyCalls=${verifyCalls}`);
    console.log(`p7c-postcondition=PASS exactText=UTF-16_LE basis=pulsar-encoding-selector-upstream independentPostActionObservation=true`);
    console.log("p7c-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true semanticConsequenceVerifiedAtDelivery=false taskOutcome=VERIFIED_SUCCESS basis=post-action-independent-observation");
    console.log("p7c-document-integrity=PASS contentHashUnchanged=true encodingSelectionNotConfirmed=true");
    console.log("p7c-promotion=NOT_RUN injectedContractOnly=true builtInContractAdded=false skillAdded=false plannerChanged=false");
    console.log("p7c-payload-policy=PASS rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p7c=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p7c=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(computerControl&&pulsarLaunched){
      try{
        const dismissed=computerControl.pressKey({key:"ESCAPE",modifiers:[]});
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
      console.log(`p7c-test-cleanup=${cleanupOk?"PASS":"FAIL"} selectorDismissed=${selectorDismissed} pointerRestored=${pointerRestored} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p7c=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
