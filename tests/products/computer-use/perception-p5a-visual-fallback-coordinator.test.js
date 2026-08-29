#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const coordinatorPath=path.join(productRoot,"app","perception-action-coordinator.js");
const coordinator=require(coordinatorPath);
const physicalPath=path.join(__dirname,"physical-tests","perception-p5a-visual-fallback-coordinator-public.js");

const PNG_SIGNATURE=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const pngBase64=PNG_SIGNATURE.toString("base64");

function displayObservation() {
  return {
    ok:true,state:"OBSERVED",
    displays:[{
      primary:true,active:true,online:true,scale:1,rotationDegrees:0,
      bounds:{x:0,y:0,width:200,height:160},
    }],
  };
}

function captureDisplay() {
  return {
    ok:true,state:"CAPTURED",display:"primary",format:"image/png",
    width:100,height:80,byteCount:PNG_SIGNATURE.length,dataBase64:pngBase64,
    cursorIncluded:false,observation:{method:"p5a-contract-fixture"},
  };
}

function providerWithTexts(texts) {
  return {
    id:"p5a.contract.text-region",locality:"local",capabilities:["text-region"],
    observe:frame=>({
      state:"OBSERVED",
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:frame.width,height:frame.height},
      observations:texts.map((text,index)=>({
        kind:"text-region",text,confidence:0.97,
        region:{x:10+index*30,y:10,width:20,height:10,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
      })),
    }),
  };
}

function mapping() {
  return {
    state:"RESOLVED",display:"primary",
    source:{kind:"capture-pixel",origin:"top-left",width:100,height:80},
    destination:{kind:"primary-display-logical",origin:"top-left",width:200,height:160},
    transform:{kind:"axis-aligned-scale",pixelToLogical:{x:2,y:2},logicalToPixel:{x:0.5,y:0.5},rotationDegrees:0},
    validation:{state:"PHYSICALLY_VALIDATED",scope:"stable-unrotated-primary-display-topology"},
  };
}

function postInterpretation(texts) {
  return {
    ok:true,state:"VISUAL_INTERPRETATION_OBSERVED",
    interpretation:{
      state:"OBSERVED",
      provider:{id:"p5a.post.fixture",locality:"local",capabilities:["text-region"]},
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:100,height:80},
      observations:texts.map((text,index)=>({
        kind:"text-region",text,confidence:0.96,
        region:{x:10+index*30,y:10,width:20,height:10,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
        semanticIdentity:null,actionable:false,
      })),
      semanticIdentityClaimed:false,
    },
    actionCoordinateMapping:mapping(),
    semanticTarget:{state:"UNRESOLVED"},
    actionPolicy:{state:"NOT_EVALUATED"},
    persistence:{policy:"EPHEMERAL",persistedByComputerUse:false},
  };
}

const targetQuery={kind:"text",match:"exact",text:"OPEN ME"};
const actionRequest={kind:"pointer-click",button:"left",display:"primary"};
const postcondition={kind:"text",match:"exact",text:"DONE"};

function run({texts=["OPEN ME"],allow=true,clickResult,postTexts=["DONE"],observeAfterDelivery}={}) {
  let clicks=0,observations=0;
  const result=coordinator.runVisualTextFallback({
    provider:providerWithTexts(texts),
    targetQuery,
    actionRequest,
    policy:{allowVisualFallback:allow},
    postcondition,
    observeAfterDelivery:observeAfterDelivery || (()=>{observations++;return postInterpretation(postTexts);}),
  },{
    captureDisplay,
    listDisplays:displayObservation,
    clickPointer:params=>{
      clicks++;
      assert.deepEqual(params,{display:"primary",x:40,y:30,button:"left"});
      return clickResult || {ok:true,state:"CLICK_POSTED",positionVerified:true,buttonDelivery:"POSTED",semanticConsequenceVerified:false};
    },
  });
  return {result,clicks,get observations(){return observations;}};
}

test("P5A composes P1B-P4 and returns verified success only from independent post-action evidence",()=>{
  const outcome=run();
  assert.equal(outcome.clicks,1);
  assert.equal(outcome.observations,1);
  assert.equal(outcome.result.state,"VISUAL_FALLBACK_VERIFIED");
  assert.equal(outcome.result.delivery.state,"POSTED");
  assert.equal(outcome.result.delivery.semanticConsequenceVerified,false);
  assert.equal(outcome.result.semanticConsequence.state,"SATISFIED");
  assert.equal(outcome.result.taskOutcome.state,"VERIFIED_SUCCESS");
  assert.equal(outcome.result.taskOutcome.basis,"post-action-independent-observation");
});

test("P5A preserves explicit-policy rejection and never dispatches Computer Control",()=>{
  const outcome=run({allow:false});
  assert.equal(outcome.clicks,0);
  assert.equal(outcome.observations,0);
  assert.equal(outcome.result.state,"VISUAL_FALLBACK_REJECTED");
  assert.equal(outcome.result.actionPolicy.reason,"VISUAL_FALLBACK_NOT_EXPLICITLY_ALLOWED");
  assert.equal(outcome.result.delivery.state,"NOT_ATTEMPTED");
});

test("P5A preserves missing and ambiguous target rejection with no dispatch",()=>{
  const missing=run({texts:["OTHER"]});
  assert.equal(missing.clicks,0);
  assert.equal(missing.observations,0);
  assert.equal(missing.result.state,"VISUAL_FALLBACK_REJECTED");
  assert.equal(missing.result.semanticTarget.state,"UNRESOLVED");
  assert.equal(missing.result.semanticTarget.reason,"NO_EXACT_TEXT_MATCH");

  const ambiguous=run({texts:["OPEN ME","OPEN ME"]});
  assert.equal(ambiguous.clicks,0);
  assert.equal(ambiguous.observations,0);
  assert.equal(ambiguous.result.state,"VISUAL_FALLBACK_REJECTED");
  assert.equal(ambiguous.result.semanticTarget.state,"AMBIGUOUS");
  assert.equal(ambiguous.result.semanticTarget.reason,"MULTIPLE_EXACT_TEXT_MATCHES");
});

test("P5A does not collapse CLICK_POSTED delivery into task success",()=>{
  const outcome=run({postTexts:["NOT DONE"]});
  assert.equal(outcome.clicks,1);
  assert.equal(outcome.observations,1);
  assert.equal(outcome.result.state,"VISUAL_FALLBACK_POSTCONDITION_NOT_SATISFIED");
  assert.equal(outcome.result.delivery.state,"POSTED");
  assert.equal(outcome.result.delivery.semanticConsequenceVerified,false);
  assert.equal(outcome.result.taskOutcome.state,"NOT_VERIFIED_SUCCESS");
});

test("P5A preserves delivery failure and never runs post-action verification",()=>{
  const outcome=run({clickResult:{ok:false,state:"FAILED",error:"CLICK_FAILED",recoveryPolicy:"NONE"}});
  assert.equal(outcome.clicks,1);
  assert.equal(outcome.observations,0);
  assert.equal(outcome.result.state,"VISUAL_FALLBACK_DELIVERY_FAILED");
  assert.equal(outcome.result.delivery.state,"FAILED");
  assert.equal(outcome.result.semanticConsequence.state,"NOT_OBSERVED");
  assert.equal(outcome.result.taskOutcome.state,"NOT_VERIFIED_SUCCESS");
});

test("P5A coordinator is composition-only: no backend bypass, persistence, planner or provider selection",()=>{
  const source=fs.readFileSync(coordinatorPath,"utf8");
  assert.match(source,/require\("\.\/perception"\)/);
  assert.match(source,/require\("\.\/perception-provider"\)/);
  assert.match(source,/require\("\.\/perception-target"\)/);
  assert.match(source,/require\("\.\/perception-action-policy"\)/);
  assert.match(source,/require\("\.\/perception-action-execution"\)/);
  assert.match(source,/acquireMappedPrimaryVisualFrame/);
  assert.match(source,/interpretMappedVisualFrame/);
  assert.match(source,/resolveExactTextTarget/);
  assert.match(source,/evaluateVisualFallbackPolicy/);
  assert.match(source,/executeAuthorizedVisualClickAndVerify/);
  assert.doesNotMatch(source,/computer-control-external|URLSession|https?:\/\//);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);
  assert.doesNotMatch(source,/agent-loop|executors|OPEN\s*\(/);
  assert.doesNotMatch(source,/selectProvider|discoverProvider|providerManager/);
  assert.doesNotMatch(source,/VERIFIED_SUCCESS|NOT_VERIFIED_SUCCESS|CLICK_POSTED/);

  const physicalSource=fs.readFileSync(physicalPath,"utf8");
  assert.match(physicalSource,/coordinator\.runVisualTextFallback\(/);
  assert.match(physicalSource,/finally\s*\{/);
  assert.match(physicalSource,/computerControl\.shutdownRuntime\(\)/);
  assert.match(physicalSource,/p5a-test-cleanup=/);
  assert.match(physicalSource,/movePointer\(/);
  assert.match(physicalSource,/process\.exitCode\s*=/);
  assert.doesNotMatch(physicalSource,/function fail[\s\S]*process\.exit\(/);
});
