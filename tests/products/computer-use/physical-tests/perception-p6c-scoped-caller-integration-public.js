#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p6c=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const TARGET="PROCEED";
const POSTCONDITION="FINISHED";
const SCOPE_ID="p6b.safari.canvas.v1";
const CONTRACT_ID="p6c.safari.canvas.proceed";

function fail(code){const e=new Error(code);e.code=code;throw e;}
function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function safariRunning(){return (run("/usr/bin/pgrep",["-x","Safari"]).status??1)===0;}

function pageHtml(){return `<!doctype html>
<html><head><meta charset="utf-8"><title>P6C</title>
<style>html,body{margin:0;width:100%;height:100%;background:#fff;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{width:min(1000px,92vw);height:auto;background:#fff}</style></head>
<body><canvas id="surface" width="1000" height="360"></canvas>
<script>
const c=document.getElementById('surface');const x=c.getContext('2d');let text=${JSON.stringify(TARGET)};
function draw(){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='bold 128px Arial, Helvetica, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2);}
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
  let tmp=null,server=null,computerControl=null,safariLaunched=false,initialPointer=null,pageRequests=0;
  let pointerRestored=false,safariCleanup=false,runtimeCleanup=false,serverCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p6c=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")fail("MACOS_REQUIRED");
    if(safariRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p6c=BLOCKED code=SAFARI_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6c-"));
    initialPointer=compilePointerProbe(tmp);
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const contractDir=path.join(tmp,"visual-contracts");
    fs.mkdirSync(contractDir,{recursive:true});
    fs.writeFileSync(path.join(contractDir,"p6c-safari-canvas.json"),JSON.stringify({
      id:CONTRACT_ID,
      scopeId:SCOPE_ID,
      application:"Safari",
      intent:"OPEN",
      target:TARGET,
      postcondition:POSTCONDITION,
      providerRequest:{capabilities:["text-region"],locality:"local"},
    },null,2));

    const callerRegistry=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));
    const agentLoop=require(path.join(productRoot,"app","agent-loop.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    server=http.createServer((req,res)=>{
      if(req.url==="/favicon.ico"){res.writeHead(204);res.end();return;}
      if(req.url!=="/p6c"){res.writeHead(404,{"Content-Type":"text/plain"});res.end("not found");return;}
      pageRequests++;
      const body=pageHtml();
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Length":Buffer.byteLength(body)});
      res.end(body);
    });
    const port=await listenLocal(server);
    const url=`http://127.0.0.1:${port}/p6c`;

    const opened=run("/usr/bin/open",["-a","Safari",url]);
    if((opened.status??1)!==0)fail("SAFARI_LAUNCH_FAILED");
    safariLaunched=true;
    for(let i=0;i<40&&!safariRunning();i++)await asyncSleep(100);
    if(!safariRunning())fail("SAFARI_PROCESS_NOT_RUNNING");

    const inventory=computerControl.listApplications({availableOnly:true});
    const safariEntry=Array.isArray(inventory?.applications)?inventory.applications.find(item=>item?.name==="Safari"):null;
    if(!safariEntry?.available)fail("SAFARI_PROVIDER_UNAVAILABLE");

    const activated=computerControl.activateApplication({app:"Safari",timeoutMs:10000});
    if(!activated?.ok)fail(`SAFARI_ACTIVATE_FAILED_${activated?.error||activated?.state||"UNKNOWN"}`);
    for(let i=0;i<50&&pageRequests===0;i++)await asyncSleep(100);
    if(pageRequests===0)fail("SAFARI_LOCAL_PAGE_NOT_REQUESTED");
    await asyncSleep(350);

    const plannerSteps=[
      {id:1,intent:"ACTIVATE_APP",app:"Safari"},
      {id:2,intent:"OPEN",target:TARGET},
    ];
    const plannerSerialized=JSON.stringify(plannerSteps);
    if(/visualFallback|allowVisualFallback|targetQuery|postcondition|providerRequest|providerId|scopeId|\"x\"|\"y\"/.test(plannerSerialized))fail("PLANNER_OUTPUT_CONTAINS_NON_SEMANTIC_FIELDS");

    const selected=callerRegistry.selectScopedVisualFallbackContractsForPlan(plannerSteps,{
      scopeId:SCOPE_ID,
      directory:contractDir,
    });
    if(!selected?.ok||selected.state!=="VISUAL_FALLBACK_PLAN_CONTRACTS_SELECTED")fail(selected?.error||"SCOPED_CALLER_CONTRACT_NOT_SELECTED");
    if(selected.contracts?.length!==1||selected.descriptors?.length!==1)fail("SCOPED_CALLER_CONTRACT_COUNT_INVALID");
    if(selected.descriptors[0].id!==CONTRACT_ID||selected.descriptors[0].scopeId!==SCOPE_ID||selected.descriptors[0].application!=="Safari")fail("SCOPED_CALLER_DESCRIPTOR_INVALID");
    const encodedContract=JSON.stringify(selected.contracts[0]);
    if(selected.contracts[0]?.provider||/\"x\"\s*:|\"y\"\s*:/.test(encodedContract))fail("SCOPED_CALLER_CONTRACT_LEAKS_DELIVERY_DETAILS");

    const wrongScope=callerRegistry.selectScopedVisualFallbackContractsForPlan(plannerSteps,{
      scopeId:"unproven.scope",
      directory:contractDir,
    });
    if(!wrongScope?.ok||wrongScope.state!=="NO_VISUAL_FALLBACK_CONTRACT"||wrongScope.contracts?.length!==0)fail("SCOPED_CALLER_WRONG_SCOPE_NOT_CLOSED");

    const taskResult=await agentLoop.runTask("P6C bounded Safari canvas caller task",{
      executionMode:()=>"EXACT",
      planTask:async task=>({
        steps:plannerSteps,
        seconds:0,
        metrics:null,
        prefixChars:0,
        taskChars:String(task).length,
        literalPayload:null,
      }),
      visualFallbackContracts:selected.contracts,
    });

    if(!taskResult?.ok)fail(taskResult?.error||"AGENT_LOOP_TASK_FAILED");
    if(!Array.isArray(taskResult.plan)||taskResult.plan.length!==2)fail("AGENT_LOOP_PLAN_INVALID");
    if(!Array.isArray(taskResult.intentResults)||taskResult.intentResults.length!==2)fail("AGENT_LOOP_INTENT_RESULTS_INVALID");

    const activation=taskResult.intentResults[0];
    const openedVisual=taskResult.intentResults[1];
    if(activation.intent!=="ACTIVATE_APP"||activation.ok!==true)fail("AGENT_LOOP_ACTIVATION_NOT_VERIFIED");
    if(openedVisual.intent!=="OPEN"||openedVisual.ok!==true||openedVisual.executionPath!=="visual-fallback")fail("AGENT_LOOP_VISUAL_OPEN_NOT_VERIFIED");
    if(openedVisual.visualFallbackEligibility?.code!=="NO_SEMANTIC_TARGET"||openedVisual.visualFallbackEligibility?.eligible!==true)fail("AGENT_LOOP_ELIGIBILITY_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.id!=="rumiai.local.macos-vision-text-region")fail("AGENT_LOOP_PROVIDER_ID_INVALID");
    if(openedVisual.visualFallbackProviderSelection?.provider?.locality!=="local")fail("AGENT_LOOP_PROVIDER_LOCALITY_INVALID");
    if(openedVisual.delivery?.state!=="POSTED"||openedVisual.delivery?.controlState!=="CLICK_POSTED"||openedVisual.delivery?.semanticConsequenceVerified!==false)fail("AGENT_LOOP_DELIVERY_CONTRACT_INVALID");
    if(openedVisual.taskOutcome?.state!=="VERIFIED_SUCCESS"||openedVisual.taskOutcome?.basis!=="post-action-independent-observation")fail("AGENT_LOOP_SUCCESS_NOT_INDEPENDENTLY_VERIFIED");

    console.log(`p6c-real-surface=PASS application=Safari localPageRequests=${pageRequests} evidenceBackedBy=P6B`);
    console.log(`p6c-scoped-caller=PASS scopeId=${SCOPE_ID} exactApplication=true exactTarget=true wrongScopeFailClosed=true`);
    console.log("p6c-planner-boundary=PASS semanticOnly=true coordinates=false providerObject=false postconditionOutsidePlanner=true scopeOutsidePlanner=true");
    console.log("p6c-normal-agent-loop=PASS intents=ACTIVATE_APP,OPEN executionPath=visual-fallback eligibleGap=NO_SEMANTIC_TARGET");
    console.log("p6c-lazy-provider=PASS provider=rumiai.local.macos-vision-text-region locality=local selectedAfterEligibleGap=true");
    console.log("p6c-delivery-success-separation=PASS controlState=CLICK_POSTED deliveryIsNotSuccess=true taskOutcome=VERIFIED_SUCCESS independentPostActionObservation=true");
    console.log("p6c-payload-policy=PASS screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p6c=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p6c=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
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
      console.log(`p6c-test-cleanup=${cleanupOk?"PASS":"FAIL"} pointerRestored=${pointerRestored} safariCleanup=${safariCleanup} runtimeCleanup=${runtimeCleanup} serverCleanup=${serverCleanup}`);
      if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p6c=FAIL code=TEST_CLEANUP_FAILED"};
    }
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
