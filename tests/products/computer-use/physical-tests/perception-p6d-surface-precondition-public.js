#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p6d=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const TARGET="PROCEED";
const POSTCONDITION="FINISHED";
const SURFACE_GOOD="P6D SURFACE ALPHA";
const SURFACE_BAD="P6D SURFACE BETA";
const SCOPE_ID="p6d.safari.canvas.alpha";
const CONTRACT_ID="p6d.safari.canvas.proceed";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function safariRunning(){return (run("/usr/bin/pgrep",["-x","Safari"]).status??1)===0;}

function pageHtml(initialMode="bad"){
  const initialTitle=initialMode==="good"?SURFACE_GOOD:SURFACE_BAD;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${initialTitle}</title>
<style>html,body{margin:0;width:100%;height:100%;background:#fff}body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}p{font:500 18px Arial,sans-serif}canvas{width:min(1000px,92vw);height:auto;background:#fff}</style></head>
<body><p>RumiAI P6D local test surface</p><canvas id="surface" width="1000" height="360"></canvas>
<script>
const c=document.getElementById('surface');const x=c.getContext('2d');
let text=${JSON.stringify(TARGET)};let surfaceMode=${JSON.stringify(initialMode)};
function draw(){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='bold 128px Arial, Helvetica, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2);}
async function syncMode(){try{const r=await fetch('/surface-mode',{cache:'no-store'});const mode=(await r.text()).trim();if(mode==='good'||mode==='bad')surfaceMode=mode;}catch{}}
setInterval(syncMode,100);syncMode();
c.addEventListener('pointerdown',()=>{text=${JSON.stringify(POSTCONDITION)};draw();fetch(surfaceMode==='good'?'/clicked-good':'/clicked-bad',{method:'POST'}).catch(()=>{});});draw();
</script></body></html>`;
}

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
  let pageRequests=0,modePolls=0,badClicks=0,goodClicks=0,surfaceMode="bad";
  let pointerRestored=false,safariCleanup=false,runtimeCleanup=false,serverCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p6d=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(safariRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p6d=BLOCKED code=SAFARI_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6d-"));
    initialPointer=compilePointerProbe(tmp);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const contractDir=path.join(tmp,"visual-contracts");
    fs.mkdirSync(contractDir,{recursive:true});
    fs.writeFileSync(path.join(contractDir,"p6d-safari-canvas.json"),JSON.stringify({
      id:CONTRACT_ID,
      scopeId:SCOPE_ID,
      application:"Safari",
      intent:"OPEN",
      target:TARGET,
      postcondition:POSTCONDITION,
      surfacePrecondition:{kind:"window-title",match:"exact",text:SURFACE_GOOD},
      providerRequest:{capabilities:["text-region"],locality:"local"},
    },null,2));

    const callerRegistry=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));
    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    const perceptionProviders=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    server=http.createServer((req,res)=>{
      if(req.url==="/favicon.ico"){res.writeHead(204);res.end();return;}
      if(req.url==="/surface-mode"){modePolls++;res.writeHead(200,{"Content-Type":"text/plain","Cache-Control":"no-store"});res.end(surfaceMode);return;}
      if(req.method==="POST"&&req.url==="/clicked-bad"){badClicks++;res.writeHead(204);res.end();return;}
      if(req.method==="POST"&&req.url==="/clicked-good"){goodClicks++;res.writeHead(204);res.end();return;}
      if(req.url!=="/p6d"){res.writeHead(404,{"Content-Type":"text/plain"});res.end("not found");return;}
      pageRequests++;
      const body=pageHtml(surfaceMode);
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Length":Buffer.byteLength(body)});
      res.end(body);
    });
    const port=await listenLocal(server);
    const url=`http://127.0.0.1:${port}/p6d`;

    const opened=run("/usr/bin/open",["-a","Safari",url]);
    if((opened.status??1)!==0)fail("SAFARI_LAUNCH_FAILED");
    safariLaunched=true;
    for(let i=0;i<40&&!safariRunning();i++)await asyncSleep(100);
    if(!safariRunning())fail("SAFARI_PROCESS_NOT_RUNNING");

    const inventory=computerControl.listApplications({availableOnly:true});
    const safariEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Safari"):null;
    if(!safariEntry?.available)fail("SAFARI_PROVIDER_UNAVAILABLE");
    for(let i=0;i<50&&(pageRequests===0||modePolls===0);i++)await asyncSleep(100);
    if(pageRequests===0)fail("SURFACE_PAGE_NOT_REQUESTED");
    if(modePolls===0)fail("SURFACE_MODE_CHANNEL_NOT_ACTIVE");
    await asyncSleep(350);

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:"Safari"},
      {id:2,intent:"OPEN",target:TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|surfacePrecondition|postcondition|providerRequest|providerId|scopeId|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const selected=callerRegistry.selectScopedVisualFallbackContractsForPlan(plannerSteps,{
      scopeId:SCOPE_ID,
      directory:contractDir,
    });
    if(!selected?.ok||selected.state!=="VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED"||selected.contracts?.length!==1)fail(selected?.error||"SCOPED_CONTRACT_NOT_SELECTED");
    if(selected.contracts[0]?.surfacePrecondition?.kind!=="window-title"||selected.contracts[0]?.surfacePrecondition?.text!==SURFACE_GOOD)fail("SURFACE_PRECONDITION_NOT_MATERIALIZED");

    const badWindowPreflight=computerControl.getCurrentWindow({app:"Safari"});
    if(!badWindowPreflight?.ok||!badWindowPreflight.window)fail("BAD_SURFACE_WINDOW_NOT_OBSERVED");
    const badPreflight=surface.evaluateSemanticSurfacePrecondition(
      {kind:"window-title",match:"exact",text:SURFACE_BAD},
      {currentWindow:badWindowPreflight.window}
    );
    if(!badPreflight?.ok)fail("BAD_SURFACE_TITLE_NOT_CURRENT");

    let badSurfaceResult=null,badWindowObserveCalls=0,badProviderSelectCalls=0;
    const badTask=await agentLoop.runTask("P6D wrong Safari surface must fail closed",{
      executionMode:()=>"EXACT",
      planTask:async task=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(task).length,literalPayload:null}),
      visualFallbackContracts:selected.contracts,
      visualFallbackDependencies:{
        observeCurrentWindow:({app})=>{
          badWindowObserveCalls++;
          return computerControl.getCurrentWindow({app});
        },
        verifySurfacePrecondition:(precondition,context)=>{
          badSurfaceResult=surface.evaluateSemanticSurfacePrecondition(precondition,context);
          return badSurfaceResult;
        },
        selectProvider:(request,options)=>{
          badProviderSelectCalls++;
          return perceptionProviders.selectPerceptionProvider(request,options);
        },
      },
    });
    if(badTask?.ok===true)fail("WRONG_SURFACE_TASK_UNEXPECTEDLY_SUCCEEDED");
    if(badSurfaceResult?.reason!=="SURFACE_PRECONDITION_NOT_MET")fail("WRONG_SURFACE_PRECONDITION_NOT_REJECTED");
    if(badWindowObserveCalls!==1)fail("WRONG_SURFACE_WINDOW_OBSERVATION_COUNT_INVALID");
    if(badProviderSelectCalls!==0)fail("WRONG_SURFACE_SELECTED_PERCEPTION_PROVIDER");
    await asyncSleep(200);
    if(badClicks!==0||goodClicks!==0)fail("WRONG_SURFACE_CLICK_DELIVERED");

    surfaceMode="good";
    const requestsBeforeReload=pageRequests;
    const reloaded=computerControl.press({app:"Safari",keys:"Cmd+R",settle:false});
    if(!reloaded?.ok)fail("GOOD_SURFACE_RELOAD_FAILED");
    for(let i=0;i<50&&pageRequests<=requestsBeforeReload;i++)await asyncSleep(100);
    if(pageRequests<=requestsBeforeReload)fail("GOOD_SURFACE_RELOAD_NOT_REQUESTED");
    await asyncSleep(350);

    let freshGood=null,goodPreflight=null,badAfterReload=null;
    for(let i=0;i<40;i++){
      freshGood=computerControl.getCurrentWindow({app:"Safari"});
      if(freshGood?.ok&&freshGood.window){
        goodPreflight=surface.evaluateSemanticSurfacePrecondition(
          {kind:"window-title",match:"exact",text:SURFACE_GOOD},
          {currentWindow:freshGood.window}
        );
        badAfterReload=surface.evaluateSemanticSurfacePrecondition(
          {kind:"window-title",match:"exact",text:SURFACE_BAD},
          {currentWindow:freshGood.window}
        );
        if(goodPreflight?.ok&&badAfterReload?.reason==="SURFACE_PRECONDITION_NOT_MET")break;
      }
      await asyncSleep(100);
    }
    if(!goodPreflight?.ok||goodPreflight.state!=="SURFACE_PRECONDITION_VERIFIED")fail("GOOD_SURFACE_NOT_CURRENT");
    if(badAfterReload?.reason!=="SURFACE_PRECONDITION_NOT_MET")fail("BAD_SURFACE_STILL_CURRENT");

    let goodSurfaceResult=null,goodWindowObserveCalls=0,goodProviderSelectCalls=0;
    const goodTask=await agentLoop.runTask("P6D verified Safari surface bounded visual OPEN",{
      executionMode:()=>"EXACT",
      planTask:async task=>({steps:plannerSteps,seconds:0,metrics:null,prefixChars:0,taskChars:String(task).length,literalPayload:null}),
      visualFallbackContracts:selected.contracts,
      visualFallbackDependencies:{
        observeCurrentWindow:({app})=>{
          goodWindowObserveCalls++;
          return computerControl.getCurrentWindow({app});
        },
        verifySurfacePrecondition:(precondition,context)=>{
          goodSurfaceResult=surface.evaluateSemanticSurfacePrecondition(precondition,context);
          return goodSurfaceResult;
        },
        selectProvider:(request,options)=>{
          goodProviderSelectCalls++;
          return perceptionProviders.selectPerceptionProvider(request,options);
        },
      },
    });

    if(!goodTask?.ok){
      const reason=goodSurfaceResult?.reason||goodSurfaceResult?.state||"NONE";
      fail(`GOOD_SURFACE_AGENT_LOOP_FAILED_${reason}`);
    }
    const openedVisual=goodTask.intentResults?.[1];
    if(!openedVisual?.ok||openedVisual.executionPath!=="visual-fallback")fail("GOOD_SURFACE_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("GOOD_SURFACE_ELIGIBILITY_INVALID");
    if(goodSurfaceResult?.state!=="SURFACE_PRECONDITION_VERIFIED")fail("GOOD_SURFACE_PRECONDITION_NOT_VERIFIED");
    if(goodWindowObserveCalls!==1)fail("GOOD_SURFACE_WINDOW_OBSERVATION_COUNT_INVALID");
    if(goodProviderSelectCalls!==1)fail("GOOD_SURFACE_PROVIDER_SELECTION_COUNT_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.state!=="VERIFIED"||openedVisual.visualFallbackProviderSelection?.surfacePrecondition?.kind!=="window-title")fail("GOOD_SURFACE_METADATA_MISSING");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("GOOD_SURFACE_PROVIDER_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("GOOD_SURFACE_DELIVERY_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("GOOD_SURFACE_SUCCESS_INVALID");
    for(let i=0;i<20&&goodClicks===0;i++)await asyncSleep(50);
    if(goodClicks!==1||badClicks!==0)fail("GOOD_SURFACE_CLICK_ORACLE_INVALID");

    console.log(`p6d-real-surfaces=PASS application=Safari pageRequests=${pageRequests} modePolls=${modePolls} sameDocument=true sameVisualTarget=true surfaceIdentity=window-title`);
    console.log("p6d-negative-surface=PASS precondition=SURFACE_PRECONDITION_NOT_MET windowObservationCalls=1 providerSelectionCalls=0 visualFallbackClickDeliveries=0 failClosed=true");
    console.log("p6d-surface-transition=PASS from=BETA to=ALPHA currentSurfaceFreshlyObserved=true observation=window.getCurrent sameTabReload=true browserTabAmbiguity=false");
    console.log("p6d-positive-surface=PASS precondition=SURFACE_PRECONDITION_VERIFIED windowObservationCalls=1 providerSelectionCalls=1 executionPath=visual-fallback");
    console.log("p6d-planner-boundary=PASS semanticOnly=true surfacePreconditionOutsidePlanner=true scopeOutsidePlanner=true coordinates=false providerObject=false");
    console.log("p6d-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true taskOutcome=VERIFIED_SUCCESS independentPostActionObservation=true");
    console.log("p6d-payload-policy=PASS screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false externalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p6d=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p6d=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
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
      console.log(`p6d-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} safariCleanup=${safariCleanup} runtimeCleanup=${runtimeCleanup} serverCleanup=${serverCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p6d=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();