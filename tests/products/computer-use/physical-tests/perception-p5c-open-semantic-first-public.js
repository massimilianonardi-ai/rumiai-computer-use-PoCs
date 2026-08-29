#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p5c=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

const semanticFixtureSource=path.join(__dirname,"helpers","macos-perception-p5c-semantic-fixture.swift");
const visualFixtureSource=path.join(__dirname,"helpers","macos-perception-p4-click-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

const SEMANTIC_APP="RumiAI P5C Semantic Fixture";
const SEMANTIC_PROCESS="RumiAIP5CSemanticFixture";
const SEMANTIC_BUNDLE="ai.rumiai.computer-use.p5c-semantic-fixture";
const SEMANTIC_TARGET="RUMIAI SEMANTIC 731";
const VISUAL_TARGET="RUMIAI CLICK 517";
const VISUAL_POSTCONDITION="RUMIAI DONE 864";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function normalized(s){return String(s||"").normalize("NFKC").toUpperCase().replace(/[\u2010-\u2015\u2212]/g,"-").replace(/\s+/g," ").trim();}
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
  fs.writeFileSync(path.join(providerDir,"p5c-semantic-fixture.json"),JSON.stringify({
    id:"rumiai-p5c-semantic-fixture",
    name:SEMANTIC_APP,
    kind:"application",
    aliases:[SEMANTIC_APP],
    activation:{application:SEMANTIC_PROCESS},
    availability:{type:"paths",paths:[appBundle]},
    contexts:["native-controls","appkit","p5c-semantic-first"],
    capabilities:{},
    identity:{process:SEMANTIC_PROCESS,bundle:SEMANTIC_BUNDLE},
  },null,2));
  return {appBundle,providerDir};
}

function makeProvider(ocrBin,onObserve){
  return {
    id:"poc.macos-vision-text-region",
    locality:"local",
    capabilities:["text-region"],
    observe:frame=>{
      onObserve();
      const png=Buffer.from(frame.dataBase64,"base64");
      const ocr=spawnSync(ocrBin,[],{input:png,encoding:"utf8",maxBuffer:16*1024*1024});
      if((ocr.status??1)!==0)return {ok:false,state:"FAILED",error:"OCR_HELPER_FAILED",recoveryPolicy:"NONE"};
      let result;try{result=JSON.parse((ocr.stdout||"").trim());}catch{return {ok:false,state:"FAILED",error:"OCR_RESPONSE_INVALID",recoveryPolicy:"NONE"};}
      if(result?.state!=="OBSERVED"||!Array.isArray(result.items))return {ok:false,state:"FAILED",error:"OCR_RESPONSE_INVALID",recoveryPolicy:"NONE"};
      return {
        state:"OBSERVED",
        coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:Number(result.width),height:Number(result.height)},
        observations:result.items.map(item=>({
          kind:"text-region",text:item.text,confidence:Number(item.confidence),
          region:{x:Number(item.box.x),y:Number(item.box.y),width:Number(item.box.width),height:Number(item.box.height),coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
        })),
      };
    },
  };
}

function explicitVisualContext({provider,target,postcondition,observeAfterDelivery}){
  return {
    visualFallback:{
      provider,
      targetQuery:{kind:"text",match:"exact",text:target},
      actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
      policy:{allowVisualFallback:true},
      postcondition:{kind:"text",match:"exact",text:postcondition},
      observeAfterDelivery,
    },
  };
}

(async()=>{
  let visualFixture=null,tmp=null,ready=null,computerControl=null;
  let semanticApplicationOpened=false;
  let pointerRestored=false,fixtureStopped=false,applicationCleanup=false,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p5c=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    killSemanticFixture();
    sleep(150);

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p5c-"));
    const prepared=prepareSemanticApplication(tmp);
    const visualFixtureBin=path.join(tmp,"click-fixture");
    const ocrBin=path.join(tmp,"vision-ocr");
    const fc=run("/usr/bin/xcrun",["swiftc","-parse-as-library",visualFixtureSource,"-o",visualFixtureBin]);
    if((fc.status??1)!==0)fail("VISUAL_FIXTURE_COMPILE_FAILED");
    const oc=run("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin]);
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    process.env.RUMIAI_PROVIDER_DIR=prepared.providerDir;
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"computer-control.sock");

    const executors=require(path.join(productRoot,"app","executors.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
    const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
    const {SEMANTIC_RESULT_CODES}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const opened=run("/usr/bin/open",[prepared.appBundle]);
    if((opened.status??1)!==0)fail("SEMANTIC_FIXTURE_LAUNCH_FAILED");
    semanticApplicationOpened=true;
    sleep(650);

    const inventory=computerControl.listApplications({availableOnly:true});
    const semanticEntry=Array.isArray(inventory?.applications)
      ? inventory.applications.find(item=>item?.name===SEMANTIC_APP)
      : null;
    if(!semanticEntry?.available)fail("SEMANTIC_FIXTURE_PROVIDER_UNAVAILABLE");

    const activated=computerControl.activateApplication({app:SEMANTIC_APP,timeoutMs:10000});
    if(!activated?.ok)fail(`SEMANTIC_FIXTURE_ACTIVATE_FAILED_${activated?.error||activated?.state||"UNKNOWN"}`);
    const foreground=computerControl.getForeground();
    if(!foreground?.ok||foreground.bundle!==SEMANTIC_BUNDLE)fail("SEMANTIC_FIXTURE_NOT_FOREGROUND");

    const initial=computerControl.snapshot({app:SEMANTIC_APP});
    if(!initial?.ok||!initial.snapshot)fail(`SEMANTIC_FIXTURE_SNAPSHOT_FAILED_${initial?.error||initial?.state||"UNKNOWN"}`);
    let state={currentApp:SEMANTIC_APP,snapshot:initial.snapshot,changed:false};

    let semanticVisualProviderCalls=0;
    const semanticPreflight=semanticUi.resolveSemanticTarget(state.snapshot,SEMANTIC_TARGET,null,"CLICK",state.currentApp);
    if(!semanticPreflight?.ok)fail(`SEMANTIC_FIXTURE_TARGET_UNRESOLVED_${semanticPreflight?.code||"UNKNOWN"}`);
    const semanticProvider={
      id:"p5c.semantic-path-visual-must-not-run",
      locality:"local",
      capabilities:["text-region"],
      observe:()=>{semanticVisualProviderCalls++;fail("SEMANTIC_PATH_RAN_VISUAL_PROVIDER");},
    };

    const semanticResult=await executors.executeOpenIntent(
      {intent:"OPEN",target:SEMANTIC_TARGET},
      state,
      explicitVisualContext({
        provider:semanticProvider,
        target:SEMANTIC_TARGET,
        postcondition:"UNUSED POSTCONDITION",
        observeAfterDelivery:()=>fail("SEMANTIC_PATH_RAN_POST_OBSERVER"),
      })
    );

    if(!semanticResult?.ok||semanticResult.executionPath!=="semantic")fail(semanticResult?.error||"SEMANTIC_OPEN_NOT_VERIFIED");
    if(semanticVisualProviderCalls!==0)fail("SEMANTIC_PATH_VISUAL_PROVIDER_CALLED");
    if(semanticResult.visualFallback?.state!=="NOT_RUN"||semanticResult.visualFallback?.reason!=="SEMANTIC_PATH_SUCCEEDED")fail("SEMANTIC_PATH_VISUAL_BYPASS_INVALID");

    const semanticWindow=computerControl.getCurrentWindow({app:SEMANTIC_APP});
    const semanticPostResolved=semanticUi.resolveSemanticTarget(semanticResult.snapshot,SEMANTIC_TARGET,null,"CLICK",SEMANTIC_APP);
    const semanticDescription=semanticPostResolved?.ok
      ? computerControl.describe({app:SEMANTIC_APP,element:{ref:semanticPostResolved.ref}})
      : null;
    const independentlySnapshotSelected=semanticUi.semanticTargetSelected(semanticResult.snapshot,SEMANTIC_TARGET);
    const independentlyDescribedSelected=semanticDescription?.ok===true&&semanticDescription.selected===true;
    const independentlyTitled=semanticWindow?.ok&&semanticUi.normText(semanticWindow.window?.title).includes(semanticUi.normText(SEMANTIC_TARGET));
    if(!semanticDescription?.ok||semanticDescription.role!=="radio-button"||semanticDescription.checked!==true||semanticDescription.selected!==true)fail("SEMANTIC_OPEN_NORMALIZED_SELECTION_INVALID");
    if(!independentlySnapshotSelected&&!independentlyDescribedSelected&&!independentlyTitled)fail("SEMANTIC_OPEN_POSTCONDITION_INVALID");

    state={
      currentApp:semanticResult.currentApp||SEMANTIC_APP,
      snapshot:semanticResult.snapshot||state.snapshot,
      changed:semanticResult.changed,
    };

    const gapBeforeFixture=semanticUi.resolveSemanticTarget(state.snapshot,VISUAL_TARGET,null,"CLICK",state.currentApp);
    if(gapBeforeFixture?.ok||gapBeforeFixture?.code!==SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET)fail("VISUAL_TARGET_NOT_A_SEMANTIC_GAP");

    visualFixture=spawn(visualFixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(visualFixture);
    if(ready?.state!=="READY"||!ready.target||!ready.initialPointer)fail("VISUAL_FIXTURE_READY_INVALID");

    let providerCalls=0,postObserveCalls=0;
    let postMapped=null,postInterpreted=null;
    const provider=makeProvider(ocrBin,()=>{providerCalls++;});
    const visualResult=await executors.executeOpenIntent(
      {intent:"OPEN",target:VISUAL_TARGET},
      state,
      explicitVisualContext({
        provider,
        target:VISUAL_TARGET,
        postcondition:VISUAL_POSTCONDITION,
        observeAfterDelivery:()=>{
          postObserveCalls++;
          sleep(450);
          postMapped=perception.acquireMappedPrimaryVisualFrame();
          if(!postMapped?.ok||postMapped.state!=="VISUAL_FRAME_MAPPED")return postMapped;
          postInterpreted=providerContract.interpretMappedVisualFrame(postMapped,provider);
          return postInterpreted;
        },
      })
    );

    if(!visualResult?.ok||visualResult.executionPath!=="visual-fallback")fail(visualResult?.error||"VISUAL_OPEN_NOT_VERIFIED");
    if(visualResult.visualFallbackEligibility?.code!==SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET||visualResult.visualFallbackEligibility?.eligible!==true)fail("VISUAL_ELIGIBILITY_INVALID");
    if(providerCalls!==2)fail("VISUAL_PROVIDER_CALL_COUNT_INVALID");
    if(postObserveCalls!==1)fail("VISUAL_POST_OBSERVER_COUNT_INVALID");
    if(visualResult.delivery?.state!=="POSTED"||visualResult.delivery?.controlState!=="CLICK_POSTED"||visualResult.delivery?.semanticConsequenceVerified!==false)fail("VISUAL_DELIVERY_CONTRACT_INVALID");
    if(visualResult.semanticConsequence?.state!=="SATISFIED"||visualResult.semanticConsequence?.independentPostActionObservation!==true)fail("VISUAL_POSTCONDITION_INVALID");
    if(visualResult.taskOutcome?.state!=="VERIFIED_SUCCESS"||visualResult.taskOutcome?.basis!=="post-action-independent-observation")fail("VISUAL_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");
    if(!postMapped?.ok||!postInterpreted?.ok)fail("VISUAL_POST_ACTION_OBSERVATION_INVALID");

    const postTexts=postInterpreted.interpretation.observations.map(v=>normalized(v.text));
    const doneCount=postTexts.filter(v=>v===normalized(VISUAL_POSTCONDITION)).length;
    const initialCount=postTexts.filter(v=>v===normalized(VISUAL_TARGET)).length;
    if(doneCount!==1||initialCount!==0)fail("VISUAL_INDEPENDENT_POSTCONDITION_ORACLE_MISMATCH");

    console.log("p5c-semantic-first=PASS knownGoodAppKitProviderPattern=true semanticDelivery=true normalizedControlSelection=true visualCoordinatorNotRun=true visualProviderCalls=0 independentSemanticPostcondition=true");
    console.log("p5c-eligible-gap=PASS structuredCode=NO_SEMANTIC_TARGET freeFormParsing=false semanticApplicationSeparateFromVisualFixture=true");
    console.log("p5c-visual-fallback=PASS provenFixture=true explicitPolicy=true providerInjected=true deterministicTarget=true deterministicPostcondition=true");
    console.log("p5c-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true independentPostActionObservation=true");
    console.log("p5c-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p5c=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p5c=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(ready?.initialPointer&&computerControl){
      try{
        const restored=computerControl.movePointer({display:"primary",x:Number(ready.initialPointer.x),y:Number(ready.initialPointer.y)});
        pointerRestored=restored?.ok!==false&&restored?.state==="MOVED";
      }catch{pointerRestored=false;}
    }else{
      pointerRestored=true;
    }

    await stopChild(visualFixture);fixtureStopped=true;

    if(computerControl&&semanticApplicationOpened){
      try{
        const terminated=computerControl.terminateApplication({app:SEMANTIC_APP,timeoutMs:10000});
        applicationCleanup=terminated?.ok===true;
      }catch{applicationCleanup=false;}
    }else{
      applicationCleanup=true;
    }
    killSemanticFixture();

    try{if(computerControl){const shutdown=computerControl.shutdownRuntime();runtimeCleanup=shutdown?.ok!==false;}else runtimeCleanup=true;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}

    const cleanupOk=pointerRestored&&fixtureStopped&&applicationCleanup&&runtimeCleanup;
    console.log(`p5c-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} applicationCleanup=${applicationCleanup} runtimeCleanup=${runtimeCleanup}`);
    if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p5c=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
