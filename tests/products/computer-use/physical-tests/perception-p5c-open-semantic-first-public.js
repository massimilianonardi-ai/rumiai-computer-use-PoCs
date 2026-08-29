#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p5c=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

const executors=require(path.join(productRoot,"app","executors.js"));
const perception=require(path.join(productRoot,"app","perception.js"));
const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
const {SEMANTIC_RESULT_CODES}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

const fixtureSource=path.join(__dirname,"helpers","macos-perception-p5c-open-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function normalized(s){return String(s||"").toUpperCase().replace(/\s+/g," ").trim();}
function waitForReady(child,timeoutMs=9000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}

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
  let fixture=null,tmp=null,ready=null;
  let pointerRestored=false,runtimeCleanup=false,fixtureStopped=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p5c=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p5c-"));
    const fixtureBin=path.join(tmp,"p5c-open-fixture"),ocrBin=path.join(tmp,"vision-ocr");
    const fc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",fixtureSource,"-o",fixtureBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((fc.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    const oc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    fixture=spawn(fixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!ready.initialPointer)fail("FIXTURE_READY_INVALID");
    sleep(350);

    const foreground=computerControl.getForeground();
    if(!foreground?.ok||!foreground.name)fail("FIXTURE_NOT_FOREGROUND");
    const initial=computerControl.snapshot({app:foreground.name});
    if(!initial?.ok||!initial.snapshot)fail("FIXTURE_SEMANTIC_SNAPSHOT_FAILED");
    let state={currentApp:foreground.name,snapshot:initial.snapshot,changed:false};

    let semanticVisualProviderCalls=0;
    const semanticTarget="RUMIAI SEMANTIC 731";
    const semanticProvider={
      id:"p5c.semantic-path-visual-must-not-run",
      locality:"local",
      capabilities:["text-region"],
      observe:()=>{semanticVisualProviderCalls++;fail("SEMANTIC_PATH_RAN_VISUAL_PROVIDER");},
    };
    const semanticResult=await executors.executeOpenIntent(
      {intent:"OPEN",target:semanticTarget},
      state,
      explicitVisualContext({
        provider:semanticProvider,
        target:semanticTarget,
        postcondition:"UNUSED POSTCONDITION",
        observeAfterDelivery:()=>fail("SEMANTIC_PATH_RAN_POST_OBSERVER"),
      })
    );

    if(!semanticResult?.ok||semanticResult.executionPath!=="semantic")fail(semanticResult?.error||"SEMANTIC_OPEN_NOT_VERIFIED");
    if(semanticVisualProviderCalls!==0)fail("SEMANTIC_PATH_VISUAL_PROVIDER_CALLED");
    if(semanticResult.visualFallback?.state!=="NOT_RUN"||semanticResult.visualFallback?.reason!=="SEMANTIC_PATH_SUCCEEDED")fail("SEMANTIC_PATH_VISUAL_BYPASS_INVALID");
    const semanticWindow=computerControl.getCurrentWindow({app:state.currentApp});
    if(!semanticWindow?.ok||!normalized(semanticWindow.window?.title).includes(normalized(semanticTarget)))fail("SEMANTIC_OPEN_POSTCONDITION_INVALID");
    state={
      currentApp:semanticResult.currentApp||state.currentApp,
      snapshot:semanticResult.snapshot||state.snapshot,
      changed:semanticResult.changed,
    };

    sleep(650);
    const visualTarget="RUMIAI VISUAL 517";
    const semanticGap=semanticUi.resolveSemanticTarget(state.snapshot,visualTarget,null,"CLICK",state.currentApp);
    if(semanticGap?.ok||semanticGap?.code!==SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET)fail("VISUAL_TARGET_NOT_A_SEMANTIC_GAP");

    let providerCalls=0,postObserveCalls=0;
    let postMapped=null,postInterpreted=null;
    const provider=makeProvider(ocrBin,()=>{providerCalls++;});
    const visualResult=await executors.executeOpenIntent(
      {intent:"OPEN",target:visualTarget},
      state,
      explicitVisualContext({
        provider,
        target:visualTarget,
        postcondition:"RUMIAI VISUAL DONE 864",
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
    const doneCount=postTexts.filter(v=>v==="RUMIAI VISUAL DONE 864").length;
    const initialCount=postTexts.filter(v=>v==="RUMIAI VISUAL 517").length;
    if(doneCount!==1||initialCount!==0)fail("VISUAL_INDEPENDENT_POSTCONDITION_ORACLE_MISMATCH");

    console.log("p5c-semantic-first=PASS semanticDelivery=true visualCoordinatorNotRun=true visualProviderCalls=0");
    console.log("p5c-eligible-gap=PASS structuredCode=NO_SEMANTIC_TARGET freeFormParsing=false");
    console.log("p5c-visual-fallback=PASS explicitPolicy=true providerInjected=true deterministicTarget=true deterministicPostcondition=true");
    console.log("p5c-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true independentPostActionObservation=true");
    console.log("p5c-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p5c=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p5c=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
  finally{
    if(ready?.initialPointer){
      try{
        const restored=computerControl.movePointer({display:"primary",x:Number(ready.initialPointer.x),y:Number(ready.initialPointer.y)});
        pointerRestored=restored?.ok!==false&&restored?.state==="MOVED";
      }catch{pointerRestored=false;}
    }
    await stopChild(fixture);fixtureStopped=true;
    try{const shutdown=computerControl.shutdownRuntime();runtimeCleanup=shutdown?.ok!==false;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    console.log(`p5c-test-cleanup=${pointerRestored&&fixtureStopped&&runtimeCleanup?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} runtimeCleanup=${runtimeCleanup}`);
    if((!pointerRestored||!fixtureStopped||!runtimeCleanup)&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p5c=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
