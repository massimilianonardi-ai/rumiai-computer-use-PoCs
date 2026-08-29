#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const executorsPath=path.join(productRoot,"app","executors.js");
const openBoundaryPath=path.join(productRoot,"app","open-semantic-first.js");
const llmPath=path.join(productRoot,"app","llm.js");
const agentLoopPath=path.join(productRoot,"app","agent-loop.js");
const executors=require(executorsPath);
const semanticUi=require(path.join(productRoot,"app","semantic-ui.js"));
const {SEMANTIC_RESULT_CODES}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));

const intent={intent:"OPEN",target:"OPEN ME"};
const state={currentApp:"FixtureApp",snapshot:'@e1 button "Other"',changed:false};

function context(overrides={}) {
  return {
    visualFallback:{
      provider:{id:"p5c.contract.provider",locality:"local",capabilities:["text-region"],observe:()=>{throw new Error("provider should be called only by P5A");}},
      targetQuery:{kind:"text",match:"exact",text:"OPEN ME"},
      actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
      policy:{allowVisualFallback:true},
      postcondition:{kind:"text",match:"exact",text:"DONE"},
      observeAfterDelivery:()=>({ok:true}),
      ...overrides,
    },
  };
}

function verifiedVisualResult() {
  return {
    ok:true,
    state:"VISUAL_FALLBACK_VERIFIED",
    delivery:{state:"POSTED",controlState:"CLICK_POSTED",semanticConsequenceVerified:false},
    semanticConsequence:{state:"SATISFIED",independentPostActionObservation:true},
    taskOutcome:{state:"VERIFIED_SUCCESS",basis:"post-action-independent-observation"},
  };
}

test("P5C OPEN stays semantic-first and never invokes visual fallback after semantic success",async()=>{
  let semanticCalls=0,visualCalls=0;
  const result=await executors.executeOpenIntent(intent,state,context(),{
    executeSemanticOpen:async()=>{
      semanticCalls++;
      return {ok:true,currentApp:state.currentApp,snapshot:"after-semantic",changed:true,detail:"semantic verified"};
    },
    runVisualFallback:()=>{visualCalls++;throw new Error("visual fallback must not run");},
  });

  assert.equal(semanticCalls,1);
  assert.equal(visualCalls,0);
  assert.equal(result.ok,true);
  assert.equal(result.executionPath,"semantic");
  assert.equal(result.visualFallback.state,"NOT_RUN");
  assert.equal(result.visualFallback.reason,"SEMANTIC_PATH_SUCCEEDED");
});

test("P5C semantic postcondition normalizes checked selectable controls without treating focus as success",()=>{
  assert.equal(
    semanticUi.semanticTargetSelected('@e1 radio "OPEN ME" [checked] [focused]',"OPEN ME"),
    true
  );
  assert.equal(
    semanticUi.semanticTargetSelected('@e1 radio-button "OPEN ME" [checked]',"OPEN ME"),
    true
  );
  assert.equal(
    semanticUi.semanticTargetSelected('@e1 checkbox "OPEN ME" [checked]',"OPEN ME"),
    true
  );
  assert.equal(
    semanticUi.semanticTargetSelected('@e1 radio "OPEN ME" [focused]',"OPEN ME"),
    false
  );
  assert.equal(
    semanticUi.semanticTargetSelected('@e1 button "OPEN ME" [checked]',"OPEN ME"),
    false
  );
});

test("P5C OPEN invokes P5A only for a structured eligible gap plus explicit deterministic context",async()=>{
  let visualCalls=0;
  const result=await executors.executeOpenIntent(intent,state,context(),{
    executeSemanticOpen:async()=>({ok:false,code:SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,error:"human text is irrelevant"}),
    runVisualFallback:visual=>{
      visualCalls++;
      assert.equal(visual.targetQuery.text,"OPEN ME");
      assert.deepEqual(visual.actionRequest,{kind:"pointer-click",button:"left",display:"primary"});
      assert.equal(visual.policy.allowVisualFallback,true);
      assert.equal(visual.postcondition.text,"DONE");
      assert.equal(typeof visual.observeAfterDelivery,"function");
      return verifiedVisualResult();
    },
  });

  assert.equal(visualCalls,1);
  assert.equal(result.ok,true);
  assert.equal(result.executionPath,"visual-fallback");
  assert.equal(result.visualFallbackEligibility.eligible,true);
  assert.equal(result.delivery.state,"POSTED");
  assert.equal(result.delivery.semanticConsequenceVerified,false);
  assert.equal(result.taskOutcome.state,"VERIFIED_SUCCESS");
  assert.equal(result.taskOutcome.basis,"post-action-independent-observation");
});

test("P5C OPEN does not perceive visually without explicit visual-fallback consent/context",async()=>{
  let visualCalls=0;
  const semanticFailure={ok:false,code:SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,error:"no semantic target"};

  for (const executionContext of [
    {},
    context({policy:{allowVisualFallback:false}}),
    context({postcondition:null}),
    context({observeAfterDelivery:null}),
    context({targetQuery:{kind:"text",match:"exact",text:"SOMETHING ELSE"}}),
  ]) {
    const result=await executors.executeOpenIntent(intent,state,executionContext,{
      executeSemanticOpen:async()=>semanticFailure,
      runVisualFallback:()=>{visualCalls++;return verifiedVisualResult();},
    });
    assert.equal(result.ok,false);
    assert.equal(result.code,SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET);
    assert.equal(result.executionPath,"semantic");
    assert.equal(result.visualFallback.state,"NOT_RUN");
  }
  assert.equal(visualCalls,0);
});

test("P5C OPEN never turns semantic delivery/verification failures into visual retries",async()=>{
  let visualCalls=0;
  for (const code of [
    SEMANTIC_RESULT_CODES.SEMANTIC_ACTION_DELIVERY_FAILED,
    SEMANTIC_RESULT_CODES.SEMANTIC_POSTCONDITION_VERIFICATION_FAILED,
    SEMANTIC_RESULT_CODES.APPLICATION_NOT_READY,
    SEMANTIC_RESULT_CODES.PERMISSION_OR_BACKEND_BLOCKED,
    SEMANTIC_RESULT_CODES.INTERNAL_EXCEPTION,
    SEMANTIC_RESULT_CODES.INVALID_INTENT,
    SEMANTIC_RESULT_CODES.INVALID_PRECONDITION,
  ]) {
    const result=await executors.executeOpenIntent(intent,state,context(),{
      executeSemanticOpen:async()=>({ok:false,code,error:"NO_SEMANTIC_TARGET text must not matter"}),
      runVisualFallback:()=>{visualCalls++;return verifiedVisualResult();},
    });
    assert.equal(result.ok,false);
    assert.equal(result.code,code);
    assert.equal(result.executionPath,"semantic");
    assert.equal(result.visualFallbackEligibility.eligible,false);
  }
  assert.equal(visualCalls,0);
});

test("P5C OPEN preserves delivery != success when P5A delivery is posted but postcondition is not verified",async()=>{
  const result=await executors.executeOpenIntent(intent,state,context(),{
    executeSemanticOpen:async()=>({ok:false,code:SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,error:"missing"}),
    runVisualFallback:()=>({
      ok:false,
      state:"VISUAL_FALLBACK_POSTCONDITION_NOT_SATISFIED",
      delivery:{state:"POSTED",controlState:"CLICK_POSTED",semanticConsequenceVerified:false},
      semanticConsequence:{state:"NOT_SATISFIED",independentPostActionObservation:true},
      taskOutcome:{state:"NOT_VERIFIED_SUCCESS"},
    }),
  });

  assert.equal(result.ok,false);
  assert.equal(result.code,"VISUAL_FALLBACK_NOT_VERIFIED");
  assert.equal(result.executionPath,"visual-fallback");
  assert.equal(result.delivery.state,"POSTED");
  assert.equal(result.delivery.semanticConsequenceVerified,false);
  assert.equal(result.taskOutcome.state,"NOT_VERIFIED_SUCCESS");
});

test("P5C boundary is executor-owned, planner-coordinate-free, provider-selection-free and agent-loop-not-yet-wired",()=>{
  const openSource=fs.readFileSync(openBoundaryPath,"utf8");
  const executorSource=fs.readFileSync(executorsPath,"utf8");
  const llmSource=fs.readFileSync(llmPath,"utf8");
  const agentSource=fs.readFileSync(agentLoopPath,"utf8");

  assert.match(openSource,/semantic-visual-fallback-eligibility/);
  assert.match(openSource,/perception-action-coordinator/);
  assert.match(executorSource,/executeOpenSemanticFirst/);
  assert.match(executorSource,/executeOpenSemanticIntent/);
  assert.match(executorSource,/SEMANTIC_ACTION_DELIVERY_FAILED/);
  assert.match(executorSource,/SEMANTIC_POSTCONDITION_VERIFICATION_FAILED/);
  assert.match(executorSource,/const snapshotSelected = semanticTargetSelected/);
  assert.match(executorSource,/describe\(\{/);
  assert.match(executorSource,/const describedSelected = described\?\.ok === true && described\.selected === true/);
  assert.match(executorSource,/const selected = snapshotSelected \|\| describedSelected/);
  assert.match(executorSource,/Delivery\/focus alone is never treated as success/);

  assert.doesNotMatch(openSource,/provider-manager|selectProvider|discoverProvider/);
  assert.doesNotMatch(openSource,/computer-control-external|agent-ctrl|https?:\/\//);
  assert.doesNotMatch(openSource,/node:fs|writeFile|createWriteStream/);
  assert.doesNotMatch(openSource,/\bx\s*:|\by\s*:/);

  assert.doesNotMatch(llmSource,/visualFallback|allowVisualFallback|targetQuery/);
  assert.doesNotMatch(agentSource,/visualFallback|allowVisualFallback|targetQuery|runVisualTextFallback/);
  assert.match(agentSource,/executeIntent\(intent, state\)/);
});
