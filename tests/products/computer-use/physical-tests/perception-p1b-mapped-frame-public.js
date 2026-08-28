#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");
const {decodePng,largestComponent}=require("../helpers/png-raster");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p1b-public=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");process.exit(2);}
const perception=require(path.join(productRoot,"app","perception.js"));
const computerControl=require(path.join(productRoot,"app","computer-control-external.js"));
const source=path.join(__dirname,"helpers","macos-perception-p1b-marker-fixture.swift");

function fail(code){const e=new Error(code);e.code=code;throw e;}
function near(a,b,t){return Math.abs(a-b)<=t;}
function waitForReady(child,timeoutMs=7000){return new Promise((resolve,reject)=>{let out="",err="";const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",chunk=>{out+=chunk;const nl=out.indexOf("\n");if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}});child.stderr.on("data",chunk=>{err+=chunk;});child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});});}
function stopChild(child){return new Promise(resolve=>{if(!child||child.exitCode!=null)return resolve();const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);child.once("exit",()=>{clearTimeout(timer);resolve();});try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}});}
function markerPredicate(color){if(color==="magenta")return p=>p&&Math.min(p.r,p.b)-p.g>=70&&Math.max(p.r,p.b)>=130;if(color==="cyan")return p=>p&&Math.min(p.g,p.b)-p.r>=70&&Math.max(p.g,p.b)>=130;throw new Error("UNKNOWN_MARKER_COLOR");}

(async()=>{
  let fixture=null,tmp=null,runtimeCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p1b-public=FAIL code=UNEXPECTED"};
  try{
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p1b-public-"));
    const bin=path.join(tmp,"marker-fixture");
    const compiled=spawnSync("/usr/bin/xcrun",["swiftc","-parse-as-library",source,"-o",bin],{encoding:"utf8",maxBuffer:8*1024*1024});
    if((compiled.status??1)!==0)fail("FIXTURE_COMPILE_FAILED");
    fixture=spawn(bin,[],{stdio:["ignore","pipe","pipe"]});
    const ready=await waitForReady(fixture);
    if(ready?.state!=="READY"||!Array.isArray(ready.markers)||ready.markers.length!==2)fail("FIXTURE_READY_INVALID");

    const mapped=perception.acquireMappedPrimaryVisualFrame();
    if(!mapped?.ok||mapped.state!=="VISUAL_FRAME_MAPPED"){
      if(mapped?.state==="BLOCKED"){outcome={code:2,marker:`physical-computer-use-perception-p1b-public=BLOCKED code=${mapped.error||"MAPPED_CAPTURE_BLOCKED"}`};return;}
      fail(mapped?.error||"MAPPED_FRAME_ACQUISITION_FAILED");
    }
    const mapping=mapped.actionCoordinateMapping;
    if(mapping?.state!=="RESOLVED")fail("MAPPING_NOT_RESOLVED");
    if(mapping?.validation?.state!=="IMPLEMENTED")fail("MAPPING_VALIDATION_STATE_PREMATURE");
    if(mapping?.source?.origin!=="top-left"||mapping?.destination?.origin!=="top-left")fail("MAPPING_ORIGIN_INVALID");
    if(mapping?.transform?.kind!=="axis-aligned-scale"||mapping?.transform?.rotationDegrees!==0)fail("MAPPING_TRANSFORM_INVALID");
    if(!near(Number(mapping.destination.width),Number(ready.displayWidth),0.5)||!near(Number(mapping.destination.height),Number(ready.displayHeight),0.5))fail("MAPPING_DESTINATION_GEOMETRY_MISMATCH");
    if(mapped.interpretation?.state!=="NOT_RUN")fail("INTERPRETATION_BOUNDARY_VIOLATED");

    const raster=decodePng(Buffer.from(mapped.frame.dataBase64,"base64"));
    let found=0;
    for(const marker of ready.markers){
      const observed=largestComponent(raster,markerPredicate(marker.color));
      if(!observed||observed.area<1000)fail("MARKER_COMPONENT_NOT_FOUND");
      found++;
      const captureCenter={x:observed.x+observed.width/2,y:observed.y+observed.height/2};
      const actual=perception.mapCapturePointToPrimaryLogical(mapping,captureCenter);
      if(!actual?.ok||actual.state!=="MAPPED")fail("PRODUCT_POINT_MAPPING_FAILED");
      const expected={x:marker.x+marker.width/2,y:marker.y+marker.height/2};
      const tolerance=4*Math.max(Number(mapping.transform.pixelToLogical.x),Number(mapping.transform.pixelToLogical.y));
      if(!near(actual.point.x,expected.x,tolerance)||!near(actual.point.y,expected.y,tolerance))fail("PRODUCT_POINT_MAPPING_MISMATCH");
    }

    console.log(`p1b-public-mapped-frame=PASS sourceWidth=${mapping.source.width} sourceHeight=${mapping.source.height} destinationWidth=${mapping.destination.width} destinationHeight=${mapping.destination.height}`);
    console.log(`p1b-public-marker-oracle=PASS count=${found} coordinatesLogged=false`);
    console.log("p1b-public-origin=PASS topLeft=true");
    console.log("p1b-public-transform=PASS axisAligned=true identityAssumed=false");
    console.log("p1b-public-product-state=PASS mapping=RESOLVED validation=IMPLEMENTED interpretation=NOT_RUN");
    console.log("p1b-public-action-boundary=PASS pointerActionsPerformed=false keyboardActionsPerformed=false");
    console.log("p1b-public-payload-policy=PASS persisted=false payloadLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p1b-public=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p1b-public=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
  finally{
    await stopChild(fixture);
    try{const shutdown=computerControl.shutdownRuntime();runtimeCleanup=shutdown?.ok!==false;}catch{runtimeCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    console.log(`p1b-public-runtime-cleanup=${runtimeCleanup?"PASS":"FAIL"}`);
    if(!runtimeCleanup&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p1b-public=FAIL code=RUNTIME_CLEANUP_FAILED"};
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
