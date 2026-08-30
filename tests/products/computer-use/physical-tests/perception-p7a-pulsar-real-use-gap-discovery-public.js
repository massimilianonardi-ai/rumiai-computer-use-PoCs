#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){
  console.error("physical-computer-use-perception-p7a=BLOCKED code=MISSING_PRODUCT_ROOT");
  process.exit(2);
}

const FILE_NAME="rumiai-p7a-visual-gap.js";
const CANDIDATES=[
  {id:"grammar",text:"JavaScript"},
  {id:"encoding",text:"UTF-8"},
  {id:"line-ending",text:"LF"},
  {id:"indentation",text:"Spaces: 2"},
];

function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function pulsarRunning(){
  return (run("/usr/bin/pgrep",["-x","Pulsar"]).status??1)===0 ||
    (run("/usr/bin/pgrep",["-f","/Pulsar.app/Contents/MacOS/Pulsar"]).status??1)===0;
}
function isPulsarForeground(result){
  return result?.ok===true&&(
    result?.name==="Pulsar" ||
    result?.process==="Pulsar" ||
    result?.bundle==="dev.pulsar-edit.pulsar" ||
    result?.bundleId==="dev.pulsar-edit.pulsar"
  );
}
function exactVisualResolved(result){
  return Boolean(
    result?.ok===true&&
    result?.state==="VISUAL_TARGET_RESOLVED"&&
    result?.semanticTarget?.state==="RESOLVED"&&
    result?.semanticTarget?.resolution?.policy==="exact-text-single-match"
  );
}

(async()=>{
  let tmp=null,computerControl=null,pulsarLaunched=false;
  let runtimeCleanup=false,pulsarCleanup=false,tempCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p7a=FAIL code=UNEXPECTED"};

  try{
    if(process.platform!=="darwin"){
      outcome={code:2,marker:"physical-computer-use-perception-p7a=BLOCKED code=MACOS_REQUIRED"};
      return;
    }
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p7a=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p7a-pulsar-"));
    const filePath=path.join(tmp,FILE_NAME);
    fs.writeFileSync(filePath,"// RumiAI P7A discovery fixture\nconst value = 1;\n","utf8");
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    process.env.RUMIAI_PERCEPTION_CACHE_DIR=path.join(tmp,"vision-cache");

    const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
    const {SEMANTIC_RESULT_CODES}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));
    const {selectPerceptionProvider}=require(path.join(productRoot,"app","perception-provider-manager.js"));
    const perception=require(path.join(productRoot,"app","perception.js"));
    const providerContract=require(path.join(productRoot,"app","perception-provider.js"));
    const {resolveExactTextTarget}=require(path.join(productRoot,"app","perception-target.js"));
    const surface=require(path.join(productRoot,"app","visual-fallback-surface-precondition.js"));
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    const inventory=computerControl.listApplications({availableOnly:true});
    const pulsarEntry=Array.isArray(inventory?.applications)
      ? inventory.applications.find(item=>item?.name==="Pulsar")
      : null;
    if(!pulsarEntry?.available){
      outcome={code:2,marker:"physical-computer-use-perception-p7a=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
      return;
    }

    const opened=run("/usr/bin/open",["-a","Pulsar",filePath]);
    if((opened.status??1)!==0)throw Object.assign(new Error("PULSAR_LAUNCH_FAILED"),{code:"PULSAR_LAUNCH_FAILED"});
    pulsarLaunched=true;
    for(let i=0;i<50&&!pulsarRunning();i++)await asyncSleep(100);
    if(!pulsarRunning())throw Object.assign(new Error("PULSAR_PROCESS_NOT_RUNNING"),{code:"PULSAR_PROCESS_NOT_RUNNING"});

    const activated=computerControl.activateApplication({app:"Pulsar",timeoutMs:10000});
    if(!activated?.ok)throw Object.assign(new Error("PULSAR_ACTIVATION_FAILED"),{code:"PULSAR_ACTIVATION_FAILED"});
    let foreground=null;
    for(let i=0;i<30;i++){
      foreground=computerControl.getForeground();
      if(isPulsarForeground(foreground))break;
      await asyncSleep(100);
    }
    if(!isPulsarForeground(foreground))throw Object.assign(new Error("PULSAR_NOT_FOREGROUND"),{code:"PULSAR_NOT_FOREGROUND"});

    let semantic=null,surfaceIdentity=null;
    for(let i=0;i<30;i++){
      semantic=computerControl.snapshot({app:"Pulsar"});
      if(semantic?.ok&&semantic.snapshot){
        surfaceIdentity=surface.evaluateSemanticSurfacePrecondition(
          {kind:"semantic-text",match:"exact",text:FILE_NAME},
          {state:{snapshot:semantic.snapshot}}
        );
        if(surfaceIdentity?.ok)break;
      }
      await asyncSleep(150);
    }
    if(!semantic?.ok||!semantic.snapshot)throw Object.assign(new Error("PULSAR_SEMANTIC_SNAPSHOT_FAILED"),{code:"PULSAR_SEMANTIC_SNAPSHOT_FAILED"});

    const semanticResults=CANDIDATES.map(candidate=>{
      const textIdentity=surface.evaluateSemanticSurfacePrecondition(
        {kind:"semantic-text",match:"exact",text:candidate.text},
        {state:{snapshot:semantic.snapshot}}
      );
      const actionable=semanticUi.resolveSemanticTarget(
        semantic.snapshot,
        candidate.text,
        null,
        "CLICK",
        "Pulsar"
      );
      return {
        ...candidate,
        semanticTextVerified:textIdentity?.ok===true&&textIdentity?.state==="SURFACE_PRECONDITION_VERIFIED",
        semanticTextMatchCount:Number(textIdentity?.metadata?.matchCount??-1),
        semanticActionable:actionable?.ok===true,
        semanticGap:actionable?.ok!==true&&actionable?.code===SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,
        semanticCode:actionable?.code||actionable?.state||"NONE",
      };
    });

    const needsVisualProbe=semanticResults.some(item=>item.semanticGap);
    let providerSelectionCalls=0,visualAttempts=0,visualResults=new Map();

    if(needsVisualProbe){
      providerSelectionCalls++;
      const selected=selectPerceptionProvider({capabilities:["text-region"],locality:"local"});
      if(!selected?.ok||selected.descriptor?.id!=="rumiai.local.macos-vision-text-region"){
        throw Object.assign(new Error("LOCAL_VISION_PROVIDER_NOT_SELECTED"),{code:"LOCAL_VISION_PROVIDER_NOT_SELECTED"});
      }

      for(let attempt=0;attempt<12;attempt++){
        visualAttempts=attempt+1;
        const mapped=perception.acquireMappedPrimaryVisualFrame();
        if(mapped?.ok){
          const interpreted=providerContract.interpretMappedVisualFrame(mapped,selected.provider);
          if(interpreted?.ok){
            for(const candidate of CANDIDATES){
              const resolved=resolveExactTextTarget(interpreted,{kind:"text",match:"exact",text:candidate.text});
              const previous=visualResults.get(candidate.id);
              const current={
                exact:exactVisualResolved(resolved),
                matchCount:Number(resolved?.semanticTarget?.matchCount??-1),
              };
              if(!previous?.exact||current.exact)visualResults.set(candidate.id,current);
            }
            if(CANDIDATES.some(candidate=>visualResults.get(candidate.id)?.exact===true))break;
          }
        }
        await asyncSleep(250);
      }
    }

    const combined=semanticResults.map(item=>({
      ...item,
      visualExact:visualResults.get(item.id)?.exact===true,
      visualMatchCount:Number(visualResults.get(item.id)?.matchCount??-1),
    }));
    const gapCandidates=combined.filter(item=>item.semanticGap&&item.visualExact);

    console.log("p7a-real-application=PASS application=Pulsar existingProvider=true temporaryFile=true userDataModified=false");
    console.log(`p7a-surface-identity=PASS kind=semantic-text match=exact verified=${surfaceIdentity?.ok===true&&surfaceIdentity?.state==="SURFACE_PRECONDITION_VERIFIED"} matchCount=${Number(surfaceIdentity?.metadata?.matchCount??-1)}`);
    for(const item of combined){
      console.log(
        `p7a-candidate=PASS id=${item.id}`+
        ` semanticTextVerified=${item.semanticTextVerified}`+
        ` semanticTextMatchCount=${item.semanticTextMatchCount}`+
        ` semanticActionable=${item.semanticActionable}`+
        ` semanticGap=${item.semanticGap}`+
        ` semanticCode=${item.semanticCode}`+
        ` visualExact=${item.visualExact}`+
        ` visualMatchCount=${item.visualMatchCount}`
      );
    }
    console.log(`p7a-visual-probe=PASS required=${needsVisualProbe} providerSelectionCalls=${providerSelectionCalls} attempts=${visualAttempts} provider=${providerSelectionCalls?"rumiai.local.macos-vision-text-region":"NONE"}`);
    console.log(`p7a-gap-candidates=PASS count=${gapCandidates.length} ids=${gapCandidates.length?gapCandidates.map(item=>item.id).join(","):"NONE"}`);
    console.log("p7a-promotion=NOT_RUN discoveryOnly=true builtInContractAdded=false skillAdded=false visualActionDelivered=false");
    console.log("p7a-payload-policy=PASS rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p7a=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p7a=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  }finally{
    if(computerControl&&pulsarLaunched){
      try{
        const result=computerControl.terminateApplication({app:"Pulsar",timeoutMs:10000});
        pulsarCleanup=result?.ok===true;
      }catch{pulsarCleanup=false;}
    }else pulsarCleanup=!pulsarLaunched;

    try{
      if(computerControl){
        const result=computerControl.shutdownRuntime();
        runtimeCleanup=result?.ok!==false;
      }else runtimeCleanup=true;
    }catch{runtimeCleanup=false;}

    if(tmp){
      try{fs.rmSync(tmp,{recursive:true,force:true});tempCleanup=true;}catch{tempCleanup=false;}
    }else tempCleanup=true;

    if(outcome.code!==2){
      const cleanupOk=pulsarCleanup&&runtimeCleanup&&tempCleanup;
      console.log(`p7a-test-cleanup=${cleanupOk?"PASS":"FAIL"} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0){
        outcome={code:1,marker:"physical-computer-use-perception-p7a=FAIL code=TEST_CLEANUP_FAILED"};
      }
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
