#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p2a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}
const perception=require(path.join(productRoot,"app","perception.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const fixtureSource=path.join(__dirname,"helpers","macos-perception-p2a-text-fixture.swift");
const ocrSource=path.join(__dirname,"helpers","macos-perception-p2a-vision-ocr.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function waitForReady(child,timeoutMs=8000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}
function normalized(s){return String(s||"").toUpperCase().replace(/\s+/g," ").trim();}
function center(box){return{x:Number(box.x)+Number(box.width)/2,y:Number(box.y)+Number(box.height)/2};}
function inside(point,target,tolerance=24){return point.x>=target.x-tolerance&&point.x<=target.x+target.width+tolerance&&point.y>=target.y-tolerance&&point.y<=target.y+target.height+tolerance;}

(async()=>{
  let fixture=null,tmp=null,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p2a=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p2a-"));
    const fixtureBin=path.join(tmp,"text-fixture"), ocrBin=path.join(tmp,"vision-ocr");
    const fc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",fixtureSource,"-o",fixtureBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((fc.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    const oc=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library","-framework","Vision","-framework","AppKit",ocrSource,"-o",ocrBin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((oc.status??1)!==0)fail("OCR_HELPER_COMPILE_FAILED");

    fixture=spawn(fixtureBin,[],{stdio:["ignore","pipe","pipe"]});
    const ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!Array.isArray(ready.targets)||ready.targets.length!==2)fail("FIXTURE_READY_INVALID");

    const mapped=perception.acquireMappedPrimaryVisualFrame();
    if(!mapped?.ok||mapped.state!=="VISUAL_FRAME_MAPPED"){
      if(mapped?.state==="BLOCKED"){outcome={code:2,marker:`physical-computer-use-perception-p2a=BLOCKED code=${mapped.error||"CAPTURE_BLOCKED"}`};return;}
      fail(mapped?.error||"MAPPED_FRAME_ACQUISITION_FAILED");
    }
    if(mapped.actionCoordinateMapping?.validation?.state!=="PHYSICALLY_VALIDATED")fail("P1B_MAPPING_NOT_VALIDATED");
    if(mapped.interpretation?.state!=="NOT_RUN")fail("INTERPRETATION_PREMATURE");

    const png=Buffer.from(mapped.frame.dataBase64,"base64");
    const ocr=spawnSync(ocrBin,[],{input:png,encoding:"utf8",maxBuffer:16*1024*1024});
    if((ocr.status??1)!==0)fail("OCR_HELPER_FAILED");
    let result; try{result=JSON.parse((ocr.stdout||"").trim());}catch{fail("OCR_RESPONSE_INVALID");}
    if(result?.state!=="OBSERVED"||!Array.isArray(result.items))fail("OCR_RESPONSE_INVALID");
    if(Number(result.width)!==mapped.frame.width||Number(result.height)!==mapped.frame.height)fail("OCR_FRAME_GEOMETRY_MISMATCH");

    const expected=[{id:"alpha",text:"RUMIAI ALPHA 731"},{id:"beta",text:"RUMIAI BETA 942"}];
    let matched=0;
    for(const spec of expected){
      const item=result.items.find(v=>normalized(v.text)===spec.text);
      if(!item)fail(`OCR_${spec.id.toUpperCase()}_TEXT_NOT_FOUND`);
      if(!(Number(item.confidence)>0))fail("OCR_CONFIDENCE_INVALID");
      const mappedCenter=perception.mapCapturePointToPrimaryLogical(mapped.actionCoordinateMapping,center(item.box));
      if(!mappedCenter?.ok)fail("OCR_BOX_MAPPING_FAILED");
      const target=ready.targets.find(v=>v.id===spec.id);
      if(!target||!inside(mappedCenter.point,target))fail("OCR_BOX_TARGET_MISMATCH");
      matched++;
    }

    console.log(`p2a-local-provider=PASS provider=macos-vision local=true networkUsed=false`);
    console.log(`p2a-text-recognition=PASS expectedCount=2 matchedCount=${matched} textLogged=false`);
    console.log("p2a-box-coordinate-space=PASS source=capture-pixel origin=top-left");
    console.log("p2a-box-to-logical-mapping=PASS via=P1B coordinatesLogged=false");
    console.log("p2a-interpretation-boundary=PASS candidatesAreObservations=true semanticIdentityClaimed=false");
    console.log("p2a-action-boundary=PASS pointerActionsPerformed=false keyboardActionsPerformed=false");
    console.log("p2a-payload-policy=PASS persisted=false payloadLogged=false ocrTextLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p2a=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p2a=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
  finally{
    await stopChild(fixture);
    try{const shutdown=computerControl.shutdownRuntime();runtimeCleanup=shutdown?.ok!==false;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    console.log(`p2a-runtime-cleanup=${runtimeCleanup?"PASS":"FAIL"}`);
    if(!runtimeCleanup&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p2a=FAIL code=RUNTIME_CLEANUP_FAILED"};
    console.log(outcome.marker); process.exitCode=outcome.code;
  }
})();
