#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
if(!productRoot){console.error("physical-computer-use-perception-p6d-surface-identity-diagnostic=BLOCKED code=MISSING_PRODUCT_ROOT");process.exit(2);}

const TITLE="P6D SURFACE BETA";
function asyncSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function run(cmd,args,options={}){return spawnSync(cmd,args,{encoding:"utf8",maxBuffer:16*1024*1024,...options});}
function safariRunning(){return (run("/usr/bin/pgrep",["-x","Safari"]).status??1)===0;}
function norm(value){return String(value||"").normalize("NFKC").toLocaleLowerCase().replace(/[\u2010-\u2015\u2212]/g,"-").replace(/\s+/g," ").trim();}
function currentTitle(result){const candidate=result?.window;const descriptor=candidate?.field==="window"&&candidate?.value&&typeof candidate.value==="object"?candidate.value:candidate;return String(descriptor?.title||"").trim();}
function isSafariForeground(result){return result?.ok===true&&(result?.name==="Safari"||result?.process==="Safari"||result?.bundle==="com.apple.Safari"||result?.bundleId==="com.apple.Safari");}
async function closeServer(server){if(!server)return;await new Promise(resolve=>server.close(()=>resolve()));}

(async()=>{
  let tmp=null,server=null,computerControl=null,safariLaunched=false;
  let pageRequests=0,runtimeCleanup=false,safariCleanup=false,serverCleanup=false;
  let outcome={code:1,marker:"physical-computer-use-perception-p6d-surface-identity-diagnostic=FAIL code=UNEXPECTED"};
  try{
    if(process.platform!=="darwin")throw Object.assign(new Error("MACOS_REQUIRED"),{code:"MACOS_REQUIRED"});
    if(safariRunning()){
      outcome={code:2,marker:"physical-computer-use-perception-p6d-surface-identity-diagnostic=BLOCKED code=SAFARI_ALREADY_RUNNING_USER_STATE_PROTECTED"};
      return;
    }
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),"rumiai-p6d-title-diag-"));
    process.env.RUMIAI_CC_SOCKET=path.join(tmp,"cc.sock");
    computerControl=require(path.join(productRoot,"app","computer-control-external.js"));

    server=http.createServer((req,res)=>{
      if(req.url==="/favicon.ico"){res.writeHead(204);res.end();return;}
      if(req.url!=="/p6d"){res.writeHead(404,{"Content-Type":"text/plain"});res.end("not found");return;}
      pageRequests++;
      const body=`<!doctype html><html><head><meta charset="utf-8"><title>${TITLE}</title></head><body><canvas width="800" height="240"></canvas><script>const c=document.querySelector('canvas'),x=c.getContext('2d');x.font='bold 96px Arial';x.fillText('PROCEED',120,140);</script></body></html>`;
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Length":Buffer.byteLength(body)});res.end(body);
    });
    await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
    const port=server.address().port;
    const hostname="127.0.0.1";
    const host=`${hostname}:${port}`;
    const origin=`http://${host}`;
    const url=`${origin}/p6d`;

    const opened=run("/usr/bin/open",["-a","Safari",url]);
    if((opened.status??1)!==0)throw Object.assign(new Error("SAFARI_LAUNCH_FAILED"),{code:"SAFARI_LAUNCH_FAILED"});
    safariLaunched=true;
    for(let i=0;i<50&&(pageRequests===0||!safariRunning());i++)await asyncSleep(100);
    if(pageRequests===0)throw Object.assign(new Error("SURFACE_PAGE_NOT_REQUESTED"),{code:"SURFACE_PAGE_NOT_REQUESTED"});

    const activated=computerControl.activateApplication({app:"Safari",timeoutMs:10000});
    if(!activated?.ok)throw Object.assign(new Error("SAFARI_ACTIVATION_FAILED"),{code:"SAFARI_ACTIVATION_FAILED"});
    let foreground=null;
    for(let i=0;i<30;i++){
      foreground=computerControl.getForeground();
      if(isSafariForeground(foreground))break;
      await asyncSleep(100);
    }
    if(!isSafariForeground(foreground))throw Object.assign(new Error("SAFARI_NOT_FOREGROUND"),{code:"SAFARI_NOT_FOREGROUND"});
    await asyncSleep(250);

    let observed=null;
    for(let i=0;i<30;i++){
      observed=computerControl.getCurrentWindow({app:"Safari"});
      if(observed?.ok&&currentTitle(observed))break;
      await asyncSleep(100);
    }
    if(!observed?.ok||!currentTitle(observed))throw Object.assign(new Error("CURRENT_WINDOW_NOT_OBSERVED"),{code:"CURRENT_WINDOW_NOT_OBSERVED"});

    const title=norm(currentTitle(observed));
    const expected=norm(TITLE);
    const suffix=title.startsWith(expected)?title.slice(expected.length):"";
    const snapshotResult=computerControl.snapshot({app:"Safari",compact:true,settle:false});
    if(!snapshotResult?.ok)throw Object.assign(new Error("SAFARI_SNAPSHOT_FAILED"),{code:"SAFARI_SNAPSHOT_FAILED"});
    const snapshot=norm(snapshotResult.snapshot);
    const windows=computerControl.listWindows({app:"Safari"});
    const listed=Array.isArray(windows?.windows)?windows.windows:[];
    const listedPrefixCount=listed.filter(item=>norm(item?.title).startsWith(expected)).length;

    const separators=[" - "," – "," — "," | "," · "];
    const candidates={};
    for(const [label,value] of Object.entries({hostname,host,origin,url,path:"/p6d"})){
      candidates[label]=separators.some(sep=>title===norm(`${TITLE}${sep}${value}`));
    }

    const diag={
      titlePresent:Boolean(title),
      titleLength:title.length,
      expectedLength:expected.length,
      startsWithExpected:title.startsWith(expected),
      suffixLength:suffix.length,
      suffixContainsHostname:suffix.includes(norm(hostname)),
      suffixContainsPort:suffix.includes(String(port)),
      suffixContainsOrigin:suffix.includes(norm(origin)),
      suffixContainsPath:suffix.includes("/p6d"),
      suffixContainsHttp:suffix.includes("http"),
      suffixContainsSafari:suffix.includes("safari"),
      suffixContainsPrivate:suffix.includes("private"),
      exactCandidateHostname:candidates.hostname,
      exactCandidateHostPort:candidates.host,
      exactCandidateOrigin:candidates.origin,
      exactCandidateUrl:candidates.url,
      exactCandidatePath:candidates.path,
      snapshotContainsTitle:snapshot.includes(expected),
      snapshotContainsFullUrl:snapshot.includes(norm(url)),
      snapshotContainsOrigin:snapshot.includes(norm(origin)),
      snapshotContainsHostPort:snapshot.includes(norm(host)),
      snapshotContainsHostname:snapshot.includes(norm(hostname)),
      snapshotContainsPath:snapshot.includes("/p6d"),
      listedPrefixCount,
    };

    console.log("p6d-safari-frontmost-precondition=PASS explicitActivation=true foregroundVerified=true");
    console.log(`p6d-safari-title-shape=PASS titlePresent=${diag.titlePresent} titleLength=${diag.titleLength} expectedLength=${diag.expectedLength} startsWithExpected=${diag.startsWithExpected} suffixLength=${diag.suffixLength}`);
    console.log(`p6d-safari-title-owned-data=PASS suffixContainsHostname=${diag.suffixContainsHostname} suffixContainsPort=${diag.suffixContainsPort} suffixContainsOrigin=${diag.suffixContainsOrigin} suffixContainsPath=${diag.suffixContainsPath} suffixContainsHttp=${diag.suffixContainsHttp} suffixContainsSafari=${diag.suffixContainsSafari} suffixContainsPrivate=${diag.suffixContainsPrivate}`);
    console.log(`p6d-safari-title-candidates=PASS hostname=${diag.exactCandidateHostname} hostPort=${diag.exactCandidateHostPort} origin=${diag.exactCandidateOrigin} url=${diag.exactCandidateUrl} path=${diag.exactCandidatePath}`);
    console.log(`p6d-safari-semantic-identity=PASS snapshotContainsTitle=${diag.snapshotContainsTitle} snapshotContainsFullUrl=${diag.snapshotContainsFullUrl} snapshotContainsOrigin=${diag.snapshotContainsOrigin} snapshotContainsHostPort=${diag.snapshotContainsHostPort} snapshotContainsHostname=${diag.snapshotContainsHostname} snapshotContainsPath=${diag.snapshotContainsPath} listedWindowPrefixCount=${diag.listedPrefixCount}`);
    console.log("p6d-safari-diagnostic-payload=PASS rawWindowTitleLogged=false snapshotLogged=false screenshotLogged=false ocrPayloadLogged=false coordinatesLogged=false externalNetwork=false");
    outcome={code:0,marker:"physical-computer-use-perception-p6d-surface-identity-diagnostic=PASS"};
  }catch(error){outcome={code:1,marker:`physical-computer-use-perception-p6d-surface-identity-diagnostic=FAIL code=${error.code||error.message||"UNEXPECTED"}`};}
  finally{
    if(computerControl&&safariLaunched){try{const r=computerControl.terminateApplication({app:"Safari",timeoutMs:10000});safariCleanup=r?.ok===true;}catch{safariCleanup=false;}}else safariCleanup=!safariLaunched;
    try{if(computerControl){const r=computerControl.shutdownRuntime();runtimeCleanup=r?.ok!==false;}else runtimeCleanup=true;}catch{runtimeCleanup=false;}
    try{await closeServer(server);serverCleanup=true;}catch{serverCleanup=false;}
    if(tmp){try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
    if(outcome.code!==2){const cleanupOk=safariCleanup&&runtimeCleanup&&serverCleanup;console.log(`p6d-safari-diagnostic-cleanup=${cleanupOk?"PASS":"FAIL"} safariCleanup=${safariCleanup} runtimeCleanup=${runtimeCleanup} serverCleanup=${serverCleanup}`);if(!cleanupOk&&outcome.code===0)outcome={code:1,marker:"physical-computer-use-perception-p6d-surface-identity-diagnostic=FAIL code=TEST_CLEANUP_FAILED"};}
    console.log(outcome.marker);process.exitCode=outcome.code;
  }
})();
