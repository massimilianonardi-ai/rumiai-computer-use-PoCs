#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p4=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}

const perception=require(path.join(productRoot,"app","perception.js"));
const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
const targetResolver=require(path.join(productRoot,"app","perception-target.js"));
const actionPolicy=require(path.join(productRoot,"app","perception-action-policy.js"));
const actionExecution=require(path.join(productRoot,"app","perception-action-execution.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const fixtureSource=path.join(__dirname,"helpers","macos-perception-p4-click-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function normalized(s){return String(s||"").toUpperCase().replace(/\s+/g," ").trim();}
function waitForReady(child,timeoutMs=8000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}

function makeProvider(ocrBin){
  return {
    id:"poc.macos-vision-text-region",
    locality:"local",
    capabilities:["text-region"],
    observe:frame=>{
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
  let outcome={code:1,marker:"physical-computer-use-perception-p4=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p4-"));
    const fixtureBin=path.join(tmp,"click-fixture"),ocrBin=path.join(tmp,"vision-ocr");
    const fc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",fixtureSource,"-o",fixtureBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((fc.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    const oc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    fixture=spawn(fixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!ready.target||!ready.initialPointer)fail("FIXTURE_READY_INVALID");

    const provider=makeProvider(ocrBin);
    const mapped=perception.acquireMappedPrimaryVisualFrame();
    if(!mapped?.ok||mapped.state!=="VISUAL_FRAME_MAPPED"){
      if(mapped?.state==="BLOCKED"){outcome={code:2,marker:`physical-computer-use-perception-p4=BLOCKED code=${mapped.error||"CAPTURE_BLOCKED"}`};return;}
      fail(mapped?.error||"MAPPED_FRAME_ACQUISITION_FAILED");
    }

    const interpreted=providerContract.interpretMappedVisualFrame(mapped,provider);
    if(!interpreted?.ok||interpreted.state!=="VISUAL_INTERPRETATION_OBSERVED")fail(interpreted?.error||"P2B_INTERPRETATION_FAILED");

    const resolved=targetResolver.resolveExactTextTarget(interpreted,{kind:"text",match:"exact",text:"RUMIAI CLICK 517"});
    if(!resolved?.ok||resolved.state!=="VISUAL_TARGET_RESOLVED")fail(resolved?.error||"P3A_TARGET_RESOLUTION_FAILED");

    const authorized=actionPolicy.evaluateVisualFallbackPolicy(
      resolved,
      {kind:"pointer-click",button:"left",display:"primary"},
      {allowVisualFallback:true}
    );
    if(!authorized?.ok||authorized.state!=="VISUAL_FALLBACK_AUTHORIZED"||authorized.actionPlan?.state!=="READY")fail(authorized?.error||"P3B_ACTION_POLICY_FAILED");

    let postInterpreted=null,postMapped=null,observeCalls=0;
    const executed=actionExecution.executeAuthorizedVisualClickAndVerify(authorized,{
      observeAfterDelivery:()=>{
        observeCalls++;
        sleep(450);
        postMapped=perception.acquireMappedPrimaryVisualFrame();
        if(!postMapped?.ok||postMapped.state!=="VISUAL_FRAME_MAPPED")return postMapped;
        postInterpreted=providerContract.interpretMappedVisualFrame(postMapped,provider);
        return postInterpreted;
      },
      postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
    });

    if(!executed?.ok||executed.state!=="VISUAL_FALLBACK_VERIFIED")fail(executed?.error||"P4_EXECUTION_NOT_VERIFIED");
    if(executed.delivery?.state!=="POSTED"||executed.delivery?.controlState!=="CLICK_POSTED"||executed.delivery?.semanticConsequenceVerified!==false)fail("P4_DELIVERY_CONTRACT_INVALID");
    if(executed.semanticConsequence?.state!=="SATISFIED"||executed.semanticConsequence?.independentPostActionObservation!==true)fail("P4_POSTCONDITION_INVALID");
    if(executed.taskOutcome?.state!=="VERIFIED_SUCCESS")fail("P4_SUCCESS_NOT_VERIFIED");
    if(observeCalls!==1||!postMapped||!postInterpreted?.ok)fail("P4_POST_ACTION_OBSERVATION_INVALID");
    if(postMapped.frame?.dataBase64===mapped.frame?.dataBase64)fail("P4_POST_ACTION_FRAME_NOT_CHANGED");

    const postTexts=postInterpreted.interpretation.observations.map(v=>normalized(v.text));
    const doneCount=postTexts.filter(v=>v==="RUMIAI DONE 864").length;
    const initialCount=postTexts.filter(v=>v==="RUMIAI CLICK 517").length;
    if(doneCount!==1||initialCount!==0)fail("P4_INDEPENDENT_POSTCONDITION_ORACLE_MISMATCH");

    console.log("p4-pre-action-chain=PASS p2bProviderNeutral=true p3aResolved=true p3bAuthorized=true");
    console.log("p4-delivery=PASS controlState=CLICK_POSTED semanticConsequenceVerified=false");
    console.log("p4-post-action-reobservation=PASS freshCapture=true expectedPostconditionPresent=true initialTextAbsent=true textLogged=false");
    console.log("p4-delivery-success-separation=PASS deliveryIsNotSuccess=true");
    console.log("p4-task-outcome=PASS state=VERIFIED_SUCCESS basis=post-action-independent-observation");
    console.log("p4-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p4=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p4=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
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
    console.log(`p4-test-cleanup=${pointerRestored&&fixtureStopped&&runtimeCleanup?"PASS":"FAIL"} pointerRestored=${pointerRestored} fixtureStopped=${fixtureStopped} runtimeCleanup=${runtimeCleanup}`);
    if((!pointerRestored||!fixtureStopped||!runtimeCleanup)&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p4=FAIL code=TEST_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
