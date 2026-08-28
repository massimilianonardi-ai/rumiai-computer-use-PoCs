#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p3a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}
const perception=require(path.join(productRoot,"app","perception.js"));
const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
const targetResolver=require(path.join(productRoot,"app","perception-target.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const fixtureSource=path.join(__dirname,"helpers","macos-perception-p2a-text-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function waitForReady(child,timeoutMs=8000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}
function inside(point,target,tolerance=24){return point.x>=target.x-tolerance&&point.x<=target.x+target.width+tolerance&&point.y>=target.y-tolerance&&point.y<=target.y+target.height+tolerance;}

(async()=>{
  let fixture=null,tmp=null,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p3a=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p3a-"));
    const fixtureBin=path.join(tmp,"text-fixture"),ocrBin=path.join(tmp,"vision-ocr");
    const fc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",fixtureSource,"-o",fixtureBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((fc.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    const oc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    fixture=spawn(fixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    const ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!Array.isArray(ready.targets)||ready.targets.length!==2)fail("FIXTURE_READY_INVALID");

    const mapped=perception.acquireMappedPrimaryVisualFrame();
    if(!mapped?.ok||mapped.state!=="VISUAL_FRAME_MAPPED"){
      if(mapped?.state==="BLOCKED"){outcome={code:2,marker:`physical-computer-use-perception-p3a=BLOCKED code=${mapped.error||"CAPTURE_BLOCKED"}`};return;}
      fail(mapped?.error||"MAPPED_FRAME_ACQUISITION_FAILED");
    }
    if(mapped.actionCoordinateMapping?.validation?.state!=="PHYSICALLY_VALIDATED")fail("P1B_MAPPING_NOT_VALIDATED");

    const provider={
      id:"poc.macos-vision-text-region",
      locality:"local",
      capabilities:["text-region"],
      observe:frame=>{
        const png=Buffer.from(frame.dataBase64,"base64");
        const ocr=spawnSync(ocrBin,[],{input:png,encoding:"utf8",maxBuffer:16*1024*1024});
        if((ocr.status??1)!==0)return {ok:false,state:"FAILED",error:"OCR_HELPER_FAILED",recoveryPolicy:"NONE"};
        let result; try{result=JSON.parse((ocr.stdout||"").trim());}catch{return {ok:false,state:"FAILED",error:"OCR_RESPONSE_INVALID",recoveryPolicy:"NONE"};}
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

    const interpreted=providerContract.interpretMappedVisualFrame(mapped,provider);
    if(!interpreted?.ok||interpreted.state!=="VISUAL_INTERPRETATION_OBSERVED")fail(interpreted?.error||"P2B_INTERPRETATION_FAILED");

    const resolved=targetResolver.resolveExactTextTarget(interpreted,{kind:"text",match:"exact",text:"RUMIAI BETA 942"});
    if(!resolved?.ok||resolved.state!=="VISUAL_TARGET_RESOLVED")fail(resolved?.error||"P3A_TARGET_RESOLUTION_FAILED");
    if(resolved.semanticTarget?.state!=="RESOLVED"||resolved.semanticTarget?.kind!=="visual-text-region")fail("P3A_TARGET_STATE_INVALID");
    if(resolved.semanticTarget?.resolution?.policy!=="exact-text-single-match")fail("P3A_RESOLUTION_POLICY_INVALID");
    if(resolved.semanticTarget?.semanticIdentity!==null||resolved.semanticTarget?.actionable!==false)fail("P3A_TARGET_BOUNDARY_VIOLATED");
    if(resolved.actionPolicy?.state!=="NOT_EVALUATED")fail("P3A_ACTION_POLICY_PREMATURE");
    if(resolved.semanticTarget?.logicalPoint?.coordinateSpace?.kind!=="primary-display-logical"||resolved.semanticTarget?.logicalPoint?.coordinateSpace?.origin!=="top-left")fail("P3A_LOGICAL_POINT_SPACE_INVALID");
    const expectedTarget=ready.targets.find(v=>v.id==="beta");
    if(!expectedTarget||!inside(resolved.semanticTarget.logicalPoint,expectedTarget))fail("P3A_TARGET_ORACLE_MISMATCH");

    console.log("p3a-target-resolution=PASS policy=exact-text-single-match resolvedCount=1");
    console.log("p3a-target-oracle=PASS logicalPointInsideExpectedWindow=true coordinatesLogged=false");
    console.log("p3a-semantic-boundary=PASS semanticIdentity=null actionable=false");
    console.log("p3a-action-policy-boundary=PASS state=NOT_EVALUATED pointerActionsPerformed=false keyboardActionsPerformed=false");
    console.log("p3a-provider-chain=PASS p2bProviderNeutral=true provider=macos-vision textLogged=false");
    console.log("p3a-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p3a=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p3a=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
  finally{
    await stopChild(fixture);
    try{const shutdown=computerControl.shutdownRuntime();runtimeCleanup=shutdown?.ok!==false;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    console.log(`p3a-runtime-cleanup=${runtimeCleanup?"PASS":"FAIL"}`);
    if(!runtimeCleanup&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p3a=FAIL code=RUNTIME_CLEANUP_FAILED"};
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
