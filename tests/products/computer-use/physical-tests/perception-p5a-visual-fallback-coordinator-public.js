#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p5a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

const coordinator=require(path.join(productRoot,"app","perception-action-coordinator.js"));
const perception=require(path.join(productRoot,"app","perception.js"));
const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const fixtureSource=path.join(__dirname,"helpers","macos-perception-p4-click-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function normalized(s){return String(s||"").toUpperCase().replace(/\s+/g," ").trim();}
function waitForReady(child,timeoutMs=8000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
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

(async()=>{
  let fixture=null,tmp=null,ready=null;
  let pointerRestored=false,runtimeCleanup=false,fixtureStopped=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p5a=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p5a-"));
    const fixtureBin=path.join(tmp,"click-fixture"),ocrBin=path.join(tmp,"vision-ocr");
    const fc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",fixtureSource,"-o",fixtureBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((fc.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    const oc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    fixture=spawn(fixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!ready.target||!ready.initialPointer)fail("FIXTURE_READY_INVALID");

    let providerCalls=0,clickCalls=0,observeAfterCalls=0;
    let postMapped=null,postInterpreted=null;
    const provider=makeProvider(ocrBin,()=>{providerCalls++;});

    const result=coordinator.runVisualTextFallback({
      provider,
      targetQuery:{kind:"text",match:"exact",text:"RUMIAI CLICK 517"},
      actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
      policy:{allowVisualFallback:true},
      postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
      observeAfterDelivery:()=>{
        observeAfterCalls++;
        sleep(450);
        postMapped=perception.acquireMappedPrimaryVisualFrame();
        if(!postMapped?.ok||postMapped.state!=="VISUAL_FRAME_MAPPED")return postMapped;
        postInterpreted=providerContract.interpretMappedVisualFrame(postMapped,provider);
        return postInterpreted;
      },
    },{
      clickPointer:params=>{
        clickCalls++;
        return computerControl.clickPointer(params);
      },
    });

    if(!result?.ok||result.state!=="VISUAL_FALLBACK_VERIFIED")fail(result?.error||"P5A_COORDINATOR_NOT_VERIFIED");
    if(clickCalls!==1)fail("P5A_CLICK_COUNT_INVALID");
    if(observeAfterCalls!==1)fail("P5A_POST_ACTION_OBSERVER_COUNT_INVALID");
    if(providerCalls!==2)fail("P5A_PROVIDER_CALL_COUNT_INVALID");
    if(result.delivery?.state!=="POSTED"||result.delivery?.controlState!=="CLICK_POSTED"||result.delivery?.semanticConsequenceVerified!==false)fail("P5A_DELIVERY_CONTRACT_INVALID");
    if(result.semanticConsequence?.state!=="SATISFIED"||result.semanticConsequence?.independentPostActionObservation!==true)fail("P5A_POSTCONDITION_INVALID");
    if(result.taskOutcome?.state!=="VERIFIED_SUCCESS"||result.taskOutcome?.basis!=="post-action-independent-observation")fail("P5A_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");
    if(!postMapped?.ok||!postInterpreted?.ok)fail("P5A_POST_ACTION_OBSERVATION_INVALID");

    const postTexts=postInterpreted.interpretation.observations.map(v=>normalized(v.text));
    const doneCount=postTexts.filter(v=>v==="RUMIAI DONE 864").length;
    const initialCount=postTexts.filter(v=>v==="RUMIAI CLICK 517").length;
    if(doneCount!==1||initialCount!==0)fail("P5A_INDEPENDENT_POSTCONDITION_ORACLE_MISMATCH");

    console.log("p5a-coordinator-composition=PASS p1bP2bP3aP3bP4=true providerInjected=true targetExplicit=true postconditionExplicit=true");
    console.log("p5a-single-action=PASS clickCalls=1 visualFallbackExplicit=true");
    console.log("p5a-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true independentPostActionObservation=true");
    console.log("p5a-post-action-reobservation=PASS providerCalls=2 expectedPostconditionPresent=true initialTextAbsent=true textLogged=false");
    console.log("p5a-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p5a=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p5a=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
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
    console.log(`p5a-test-cleanup=${pointerRestored&&fixtureStopped&&runtimeCleanup?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} runtimeCleanup=${runtimeCleanup}`);
    if((!pointerRestored||!fixtureStopped||!runtimeCleanup)&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p5a=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
