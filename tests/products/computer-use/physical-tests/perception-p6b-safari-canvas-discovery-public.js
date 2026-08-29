#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p6b=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const TARGET="RUMIAI CANVAS OPEN";
const POSTCONDITION="RUMIAI CANVAS DONE";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function safariRunning(){return (run("/usr/bin/pgrep",["-x","Safari"]).status??1)===0;}
function normalized(value){return String(value||"").normalize("NFKC").toUpperCase().replace(/[\u2010-\u2015\u2212]/g,"-").replace(/\s+/g," ").trim();}
function exactResolved(result){return Boolean(result?.ok===true&&result?.state==="VISUAL_TARGET_RESOLVED"&&result?.semanticTarget?.state==="RESOLVED"&&result?.semanticTarget?.resolution?.policy==="exact-text-single-match");}
function exactUnresolved(result){return Boolean(result?.ok===true&&result?.state==="VISUAL_TARGET_UNRESOLVED"&&result?.semanticTarget?.state==="UNRESOLVED"&&result?.semanticTarget?.reason==="NO_EXACT_TEXT_MATCH"&&result?.semanticTarget?.matchCount===0);}

function pageHtml(){return `<!doctype html>
<html><head><meta charset="utf-8"><title>RumiAI P6B Canvas Discovery</title>
<style>html,body{margin:0;width:100%;height:100%;background:#fff;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{width:min(1200px,94vw);height:auto;background:#fff}</style></head>
<body><canvas id="surface" width="1200" height="420"></canvas>
<script>
const c=document.getElementById('surface');const x=c.getContext('2d');let text=${JSON.stringify(TARGET)};
function draw(){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='bold 80px Arial, Helvetica, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2);}
c.addEventListener('pointerdown',()=>{text=${JSON.stringify(POSTCONDITION)};draw();});draw();
</script></body></html>`;}

async function listenLocal(server){
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return server.address().port;
}

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

async function closeServer(server){if(!server)return;await new Promise(resolve=>server.close(()=>resolve()));}

(async()=>{
  let tmp=null,server=null,computerControl=null,safariLaunched=false,initialPointer=null;
  let pointerRestored=false,safariCleanup=false,runtimeCleanup=false,serverCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p6b=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(safariRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p6b=BLOCKED code=SAFARI_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6b-"));
    initialPointer=compilePointerProbe(tmp);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
    const {SEMANTIC_RESULT_CODES}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));
    const {selectPerceptionProvider}=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
    const {resolveExactTextTarget}=require(path.join(productRoot,"app","perception-target.js"));
    const {runVisualTextFallback}=require(path.join(productRoot,"app","perception-action-coordinator.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    server=http.createServer((req,res)=>{
      if(req.url==="/favicon.ico"){res.writeHead(204);res.end();return;}
      if(req.url!=="/p6b"){res.writeHead(404,{"Content-Type":"text/plain"});res.end("not found");return;}
      const body=pageHtml();res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Length":Buffer.byteLength(body)});res.end(body);
    });
    const port=await listenLocal(server);
    const url=`http://127.0.0.1:${port}/p6b`;

    const opened=run("/usr/bin/open",["-a","Safari",url]);
    if((opened.status??1)!==0)fail("SAFARI_LAUNCH_FAILED");
    safariLaunched=true;
    for(let i=0;i<40&&!safariRunning();i++)sleep(100);
    if(!safariRunning())fail("SAFARI_PROCESS_NOT_RUNNING");

    const inventory=computerControl.listApplications({availableOnly:true});
    const safariEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Safari"):null;
    if(!safariEntry?.available)fail("SAFARI_PROVIDER_UNAVAILABLE");

    const activated=computerControl.activateApplication({app:"Safari",timeoutMs:10000});
    if(!activated?.ok)fail(`SAFARI_ACTIVATE_FAILED_${activated?.error||activated?.state||"UNKNOWN"}`);
    const foreground=computerControl.getForeground();
    if(!foreground?.ok||foreground.bundle!=="com.apple.Safari")fail("SAFARI_NOT_FOREGROUND");

    const selected=selectPerceptionProvider({capabilities:["text-region"],locality:"local"});
    if(!selected?.ok||selected.descriptor?.id!=="rumiai.local.macos-vision-text-region")fail("LOCAL_VISION_PROVIDER_NOT_SELECTED");
    const provider=selected.provider;

    let preMapped=null,preInterpreted=null,preResolved=null,preAttempts=0;
    for(let attempt=0;attempt<20;attempt++){
      preAttempts=attempt+1;
      preMapped=perception.acquireMappedPrimaryVisualFrame();
      if(preMapped?.ok){
        preInterpreted=providerContract.interpretMappedVisualFrame(preMapped,provider);
        if(preInterpreted?.ok){
          preResolved=resolveExactTextTarget(preInterpreted,{kind:"text",match:"exact",text:TARGET});
          if(exactResolved(preResolved))break;
        }
      }
      sleep(350);
    }
    if(!exactResolved(preResolved)){
      console.log(
        `p6b-pre-target-diagnostic=FAIL attempts=${preAttempts}`+
        ` resolutionState=${preResolved?.state||"NONE"}`+
        ` semanticTargetState=${preResolved?.semanticTarget?.state||"NONE"}`+
        ` reason=${preResolved?.semanticTarget?.reason||preResolved?.error||"NONE"}`+
        ` matchCount=${preResolved?.semanticTarget?.matchCount??-1}`+
        ` observationCount=${preInterpreted?.interpretation?.observations?.length??-1}`
      );
      fail("SAFARI_CANVAS_VISUAL_TARGET_NOT_RESOLVED");
    }
    const prePost=resolveExactTextTarget(preInterpreted,{kind:"text",match:"exact",text:POSTCONDITION});
    if(!exactUnresolved(prePost))fail("SAFARI_CANVAS_POSTCONDITION_PRESTATE_INVALID");

    const semantic=computerControl.snapshot({app:"Safari"});
    if(!semantic?.ok||!semantic.snapshot)fail(`SAFARI_SEMANTIC_SNAPSHOT_FAILED_${semantic?.error||semantic?.state||"UNKNOWN"}`);
    const semanticTarget=semanticUi.resolveSemanticTarget(semantic.snapshot,TARGET,null,"CLICK","Safari");
    if(semanticTarget?.ok||semanticTarget?.code!==SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET)fail("SAFARI_CANVAS_NOT_A_SEMANTIC_GAP");

    let postMapped=null,postInterpreted=null,postObserveCalls=0;
    const result=runVisualTextFallback({
      provider,
      targetQuery:{kind:"text",match:"exact",text:TARGET},
      actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
      policy:{allowVisualFallback:true},
      postcondition:{kind:"text",match:"exact",text:POSTCONDITION},
      observeAfterDelivery:()=>{
        postObserveCalls++;
        sleep(500);
        postMapped=perception.acquireMappedPrimaryVisualFrame();
        if(!postMapped?.ok)return postMapped;
        postInterpreted=providerContract.interpretMappedVisualFrame(postMapped,provider);
        return postInterpreted;
      },
    });

    if(!result?.ok||result.taskOutcome?.state!=="VERIFIED_SUCCESS")fail(result?.error||result?.state||"SAFARI_CANVAS_VISUAL_FALLBACK_NOT_VERIFIED");
    if(result.delivery?.state!=="POSTED"||result.delivery?.controlState!=="CLICK_POSTED"||result.delivery?.semanticConsequenceVerified!==false)fail("SAFARI_CANVAS_DELIVERY_CONTRACT_INVALID");
    if(result.semanticConsequence?.independentPostActionObservation!==true)fail("SAFARI_CANVAS_POST_OBSERVATION_NOT_INDEPENDENT");
    if(postObserveCalls!==1||!postInterpreted?.ok)fail("SAFARI_CANVAS_POST_OBSERVATION_INVALID");

    const texts=postInterpreted.interpretation.observations.map(item=>normalized(item.text));
    const doneCount=texts.filter(text=>text===normalized(POSTCONDITION)).length;
    const initialCount=texts.filter(text=>text===normalized(TARGET)).length;
    if(doneCount!==1||initialCount!==0)fail("SAFARI_CANVAS_POSTCONDITION_ORACLE_MISMATCH");

    console.log("p6b-real-application=PASS application=Safari providerBoundary=existing-product-provider localPage=true externalNetwork=false");
    console.log("p6b-semantic-gap=PASS code=NO_SEMANTIC_TARGET canvasTextSemanticTarget=false");
    console.log("p6b-visual-target=PASS provider=rumiai.local.macos-vision-text-region exactSingleMatch=true prePostcondition=ABSENT");
    console.log("p6b-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true taskOutcome=VERIFIED_SUCCESS independentPostActionObservation=true");
    console.log("p6b-contract-promotion=NOT_RUN builtInSafariContract=false discoveryOnly=true");
    console.log("p6b-payload-policy=PASS screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p6b=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p6b=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(initialPointer&&computerControl){
      try{const r=computerControl.movePointer({display:"primary",x:Number(initialPointer.x),y:Number(initialPointer.y)});pointerRestored=r?.ok!==false&&r?.state==="MOVED";}catch{pointerRestored=false;}
    }else pointerRestored=true;

    if(computerControl&&safariLaunched){
      try{const r=computerControl.terminateApplication({app:"Safari",timeoutMs:10000});safariCleanup=r?.ok===true;}catch{safariCleanup=false;}
    }else safariCleanup=!safariLaunched;

    try{if(computerControl){const r=computerControl.shutdownRuntime();runtimeCleanup=r?.ok!==false;}else runtimeCleanup=true;}catch{runtimeCleanup=false;}
    try{await closeServer(server);serverCleanup=true;}catch{serverCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}

    if(outcome.code!==2){
      const cleanupOk=pointerRestored&&safariCleanup&&runtimeCleanup&&serverCleanup;
      console.log(`p6b-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} safariCleanup=${safariCleanup} runtimeCleanup=${runtimeCleanup} serverCleanup=${serverCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p6b=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
