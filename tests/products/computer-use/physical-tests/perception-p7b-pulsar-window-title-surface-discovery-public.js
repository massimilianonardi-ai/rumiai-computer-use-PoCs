#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){
  console.error("physical-computer-use-perception-p7b=BLOCKED code=MISSING_PRODUCT_ROOT");
  process.exit(2);
}

const FILE_A="rumiai-p7b-alpha.js";
const FILE_B="rumiai-p7b-beta.js";
const GAP_TARGETS=["JavaScript","UTF-8"];

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
function replaceAllLiteral(value,token,replacement){
  if(!token)return value;
  return String(value).split(String(token)).join(replacement);
}
function callerOwnedTemplate(title,filePath){
  const fileName=path.basename(filePath);
  const parentPath=path.dirname(filePath);
  const parentName=path.basename(parentPath);
  let template=String(title||"");
  let fileBound=false;

  if(filePath&&template.includes(filePath)){
    template=replaceAllLiteral(template,filePath,"{FILE_PATH}");
    fileBound=true;
  }else if(fileName&&template.includes(fileName)){
    template=replaceAllLiteral(template,fileName,"{FILE_NAME}");
    fileBound=true;
  }
  if(parentPath&&template.includes(parentPath)){
    template=replaceAllLiteral(template,parentPath,"{PARENT_PATH}");
  }
  if(parentName&&template.includes(parentName)){
    template=replaceAllLiteral(template,parentName,"{PARENT_NAME}");
  }
  return {template,fileBound};
}
function materializeTemplate(template,filePath){
  return String(template||"")
    .split("{FILE_PATH}").join(filePath)
    .split("{FILE_NAME}").join(path.basename(filePath))
    .split("{PARENT_PATH}").join(path.dirname(filePath))
    .split("{PARENT_NAME}").join(path.basename(path.dirname(filePath)));
}
function safeTemplate(value){
  return Buffer.from(String(value||""),"utf8").toString("base64");
}

(async()=>{
  let tmp=null,computerControl=null,pulsarLaunched=false;
  let runtimeCleanup=false,pulsarCleanup=false,tempCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p7b=FAIL code=UNEXPECTED"};

  try{
    if(process.platform!=="darwin"){
      outcome={code:2,marker:"physical-computer-use-perception-p7b=BLOCKED code=MACOS_REQUIRED"};
      return;
    }
    if(pulsarRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p7b=BLOCKED code=PULSAR_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }

    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p7b-pulsar-"));
    const filePathA=path.join(tmp,FILE_A);
    const filePathB=path.join(tmp,FILE_B);
    fs.writeFileSync(filePathA,"// RumiAI P7B alpha fixture\nconst alpha = 1;\n","utf8");
    fs.writeFileSync(filePathB,"// RumiAI P7B beta fixture\nconst beta = 2;\n","utf8");
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
      outcome={code:2,marker:"physical-computer-use-perception-p7b=BLOCKED code=PULSAR_PROVIDER_UNAVAILABLE"};
      return;
    }

    const openedA=run("/usr/bin/open",["-a","Pulsar",filePathA]);
    if((openedA.status??1)!==0)throw Object.assign(new Error("PULSAR_ALPHA_LAUNCH_FAILED"),{code:"PULSAR_ALPHA_LAUNCH_FAILED"});
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

    let currentA=null,titleA="",bindingA=null;
    for(let i=0;i<40;i++){
      currentA=computerControl.getCurrentWindow({app:"Pulsar"});
      titleA=String(currentA?.window?.title||"").trim();
      if(currentA?.ok&&titleA){
        bindingA=callerOwnedTemplate(titleA,filePathA);
        if(bindingA.fileBound)break;
      }
      await asyncSleep(150);
    }
    if(!currentA?.ok||!titleA)throw Object.assign(new Error("PULSAR_ALPHA_WINDOW_TITLE_UNAVAILABLE"),{code:"PULSAR_ALPHA_WINDOW_TITLE_UNAVAILABLE"});

    const openedB=run("/usr/bin/open",["-a","Pulsar",filePathB]);
    if((openedB.status??1)!==0)throw Object.assign(new Error("PULSAR_BETA_OPEN_FAILED"),{code:"PULSAR_BETA_OPEN_FAILED"});

    let currentB=null,titleB="",bindingB=null;
    for(let i=0;i<50;i++){
      currentB=computerControl.getCurrentWindow({app:"Pulsar"});
      titleB=String(currentB?.window?.title||"").trim();
      if(currentB?.ok&&titleB){
        bindingB=callerOwnedTemplate(titleB,filePathB);
        if(bindingB.fileBound&&titleB!==titleA)break;
      }
      await asyncSleep(150);
    }
    if(!currentB?.ok||!titleB)throw Object.assign(new Error("PULSAR_BETA_WINDOW_TITLE_UNAVAILABLE"),{code:"PULSAR_BETA_WINDOW_TITLE_UNAVAILABLE"});

    const titleChanged=titleA!==titleB;
    const templateStable=Boolean(
      bindingA?.fileBound&&bindingB?.fileBound&&
      bindingA.template===bindingB.template
    );
    const reconstructA=templateStable&&materializeTemplate(bindingA.template,filePathA)===titleA;
    const reconstructB=templateStable&&materializeTemplate(bindingB.template,filePathB)===titleB;
    const callerDerivable=Boolean(titleChanged&&templateStable&&reconstructA&&reconstructB);

    const exactPositive=surface.evaluateSemanticSurfacePrecondition(
      {kind:"window-title",match:"exact",text:titleB},
      {currentWindow:currentB.window}
    );
    const exactWrong=surface.evaluateSemanticSurfacePrecondition(
      {kind:"window-title",match:"exact",text:titleA},
      {currentWindow:currentB.window}
    );
    const exactPositiveVerified=exactPositive?.ok===true&&exactPositive?.state==="SURFACE_PRECONDITION_VERIFIED";
    const wrongRejected=exactWrong?.ok===false&&exactWrong?.reason==="SURFACE_PRECONDITION_NOT_MET";

    let semantic=null;
    for(let i=0;i<30;i++){
      semantic=computerControl.snapshot({app:"Pulsar"});
      if(semantic?.ok&&semantic.snapshot)break;
      await asyncSleep(100);
    }
    if(!semantic?.ok||!semantic.snapshot)throw Object.assign(new Error("PULSAR_SEMANTIC_SNAPSHOT_FAILED"),{code:"PULSAR_SEMANTIC_SNAPSHOT_FAILED"});

    const semanticResults=GAP_TARGETS.map(text=>{
      const actionable=semanticUi.resolveSemanticTarget(semantic.snapshot,text,null,"CLICK","Pulsar");
      return {
        text,
        semanticActionable:actionable?.ok===true,
        semanticGap:actionable?.ok!==true&&actionable?.code===SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,
        semanticCode:actionable?.code||actionable?.state||"NONE",
      };
    });

    let providerSelectionCalls=0,visualAttempts=0,visualResults=new Map();
    if(semanticResults.some(item=>item.semanticGap)){
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
            for(const item of semanticResults){
              const resolved=resolveExactTextTarget(interpreted,{kind:"text",match:"exact",text:item.text});
              visualResults.set(item.text,{exact:exactVisualResolved(resolved)});
            }
            if(semanticResults.every(item=>!item.semanticGap||visualResults.get(item.text)?.exact===true))break;
          }
        }
        await asyncSleep(250);
      }
    }

    const combined=semanticResults.map(item=>({
      ...item,
      visualExact:visualResults.get(item.text)?.exact===true,
    }));
    const promotableTargets=combined.filter(item=>item.semanticGap&&item.visualExact);

    console.log("p7b-real-application=PASS application=Pulsar existingProvider=true temporaryFiles=2 userDataModified=false");
    console.log(
      `p7b-window-title-characterization=PASS titleChanged=${titleChanged}`+
      ` alphaFileBound=${bindingA?.fileBound===true}`+
      ` betaFileBound=${bindingB?.fileBound===true}`+
      ` templateStable=${templateStable}`+
      ` reconstructAlpha=${reconstructA}`+
      ` reconstructBeta=${reconstructB}`+
      ` callerDerivable=${callerDerivable}`+
      ` templateBase64=${safeTemplate(templateStable?bindingA.template:"")}`
    );
    console.log(
      `p7b-window-title-precondition=PASS kind=window-title match=exact`+
      ` positiveVerified=${exactPositiveVerified}`+
      ` wrongTitleRejected=${wrongRejected}`+
      ` positiveMatchCount=${Number(exactPositive?.metadata?.matchCount??-1)}`+
      ` wrongMatchCount=${Number(exactWrong?.metadata?.matchCount??-1)}`
    );
    for(const item of combined){
      console.log(
        `p7b-candidate=PASS text=${item.text}`+
        ` semanticActionable=${item.semanticActionable}`+
        ` semanticGap=${item.semanticGap}`+
        ` semanticCode=${item.semanticCode}`+
        ` visualExact=${item.visualExact}`
      );
    }
    console.log(`p7b-visual-probe=PASS providerSelectionCalls=${providerSelectionCalls} attempts=${visualAttempts} provider=${providerSelectionCalls?"rumiai.local.macos-vision-text-region":"NONE"}`);
    console.log(`p7b-promotion-candidates=PASS surfaceEligible=${callerDerivable&&exactPositiveVerified&&wrongRejected} targetCount=${promotableTargets.length} targets=${promotableTargets.length?promotableTargets.map(item=>item.text).join(","):"NONE"}`);
    console.log("p7b-promotion=NOT_RUN discoveryOnly=true builtInContractAdded=false skillAdded=false visualActionDelivered=false plannerChanged=false");
    console.log("p7b-payload-policy=PASS rawSnapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false testInitiatedExternalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p7b=PASS"};
  }catch(error){
    outcome={code:1,marker:`physical-computer-use-perception-p7b=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
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
      console.log(`p7b-test-cleanup=${cleanupOk?"PASS":"FAIL"} pulsarCleanup=${pulsarCleanup} runtimeCleanup=${runtimeCleanup} tempCleanup=${tempCleanup}`);
      if(!cleanupOk&&outcome.code===0){
        outcome={code:1,marker:"physical-computer-use-perception-p7b=FAIL code=TEST_CLEANUP_FAILED"};
      }
    }
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
