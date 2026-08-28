#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const executionPath=path.join(productRoot,"app","perception-action-execution.js");
const execution=require(executionPath);

function mapping() {
  return {
    state:"RESOLVED",display:"primary",
    source:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
    destination:{kind:"primary-display-logical",origin:"top-left",width:1200,height:800},
    transform:{kind:"axis-aligned-scale",pixelToLogical:{x:2,y:2},logicalToPixel:{x:0.5,y:0.5},rotationDegrees:0},
    validation:{state:"PHYSICALLY_VALIDATED",scope:"stable-unrotated-primary-display-topology"},
  };
}

function authorized() {
  return {
    ok:true,
    state:"VISUAL_FALLBACK_AUTHORIZED",
    semanticTarget:{
      state:"RESOLVED",kind:"visual-text-region",semanticIdentity:null,actionable:false,
      logicalPoint:{x:540,y:230,coordinateSpace:{kind:"primary-display-logical",origin:"top-left"}},
    },
    actionCoordinateMapping:mapping(),
    actionPolicy:{state:"AUTHORIZED",policy:"explicit-single-target-left-click"},
    actionPlan:{
      state:"READY",kind:"pointer-click",button:"left",display:"primary",source:"visual-target-policy",
      point:{x:540,y:230,coordinateSpace:{kind:"primary-display-logical",origin:"top-left"}},
    },
    delivery:{state:"NOT_ATTEMPTED"},
    semanticConsequence:{state:"NOT_OBSERVED"},
    persistence:{policy:"EPHEMERAL",persistedByComputerUse:false},
  };
}

function interpretation(texts) {
  return {
    ok:true,
    state:"VISUAL_INTERPRETATION_OBSERVED",
    interpretation:{
      state:"OBSERVED",
      provider:{id:"fixture",locality:"local",capabilities:["text-region"]},
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
      observations:texts.map((text,index)=>({
        kind:"text-region",text,confidence:0.95,
        region:{x:30+index*180,y:40,width:130,height:30,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
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

function clickPosted() {
  return {state:"CLICK_POSTED",positionVerified:true,buttonDelivery:"POSTED",semanticConsequenceVerified:false};
}

test("P4 separates CLICK_POSTED delivery from independently verified semantic success",()=>{
  let clickCalled=false,observeCalled=false;
  const result=execution.executeAuthorizedVisualClickAndVerify(authorized(),{
    clickPointer:params=>{
      clickCalled=true;
      assert.deepEqual(params,{display:"primary",x:540,y:230,button:"left"});
      return clickPosted();
    },
    observeAfterDelivery:()=>{
      assert.equal(clickCalled,true,"post-action observation must happen only after delivery");
      observeCalled=true;
      return interpretation(["RUMIAI DONE 864"]);
    },
    postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
  });
  assert.equal(observeCalled,true);
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FALLBACK_VERIFIED");
  assert.equal(result.delivery.state,"POSTED");
  assert.equal(result.delivery.controlState,"CLICK_POSTED");
  assert.equal(result.delivery.semanticConsequenceVerified,false);
  assert.equal(result.semanticConsequence.state,"SATISFIED");
  assert.equal(result.semanticConsequence.independentPostActionObservation,true);
  assert.equal(result.taskOutcome.state,"VERIFIED_SUCCESS");
});

test("P4 never upgrades posted delivery to success when postcondition is absent",()=>{
  const result=execution.executeAuthorizedVisualClickAndVerify(authorized(),{
    clickPointer:()=>clickPosted(),
    observeAfterDelivery:()=>interpretation(["SOMETHING ELSE"]),
    postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
  });
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FALLBACK_POSTCONDITION_NOT_SATISFIED");
  assert.equal(result.delivery.state,"POSTED");
  assert.equal(result.semanticConsequence.state,"OBSERVED_NOT_SATISFIED");
  assert.equal(result.taskOutcome.state,"NOT_VERIFIED_SUCCESS");
});

test("P4 does not re-observe when Computer Control does not return CLICK_POSTED",()=>{
  let observed=false;
  const result=execution.executeAuthorizedVisualClickAndVerify(authorized(),{
    clickPointer:()=>({ok:false,state:"FAILED",error:"CLICK_FAILED",recoveryPolicy:"NONE"}),
    observeAfterDelivery:()=>{observed=true;return interpretation(["RUMIAI DONE 864"]);},
    postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
  });
  assert.equal(observed,false);
  assert.equal(result.ok,false);
  assert.equal(result.state,"VISUAL_FALLBACK_DELIVERY_FAILED");
  assert.equal(result.delivery.state,"FAILED");
  assert.equal(result.semanticConsequence.state,"NOT_OBSERVED");
  assert.equal(result.taskOutcome.state,"NOT_VERIFIED_SUCCESS");
});

test("P4 rejects unauthorized or malformed plans before input delivery",()=>{
  let clicks=0;
  const bad={...authorized(),state:"VISUAL_FALLBACK_REJECTED",actionPolicy:{state:"REJECTED"},actionPlan:{state:"NOT_CREATED"}};
  const result=execution.executeAuthorizedVisualClickAndVerify(bad,{
    clickPointer:()=>{clicks++;return clickPosted();},
    observeAfterDelivery:()=>interpretation(["RUMIAI DONE 864"]),
    postcondition:{kind:"text",match:"exact",text:"RUMIAI DONE 864"},
  });
  assert.equal(clicks,0);
  assert.equal(result.error,"VISUAL_FALLBACK_ACTION_PLAN_INVALID");
});

test("P4 product boundary uses public Computer Control click and does not persist or infer success from delivery",()=>{
  const source=fs.readFileSync(executionPath,"utf8");
  assert.match(source,/require\("\.\/computer-control-external"\)\.clickPointer/);
  assert.match(source,/state === "CLICK_POSTED"/);
  assert.match(source,/semanticConsequenceVerified === false/);
  assert.match(source,/observeAfterDelivery\(\)/);
  assert.match(source,/resolveExactTextTarget/);
  assert.match(source,/VERIFIED_SUCCESS/);
  assert.match(source,/NOT_VERIFIED_SUCCESS/);
  assert.doesNotMatch(source,/movePointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);
  assert.doesNotMatch(source,/URLSession|https?:\/\//);
});
