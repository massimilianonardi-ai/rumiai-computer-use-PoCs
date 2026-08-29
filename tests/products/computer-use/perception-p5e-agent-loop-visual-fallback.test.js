#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const {
  executeOpenSemanticFirst,
}=require(path.join(productRoot,"app","open-semantic-first.js"));
const {
  createLazyOpenVisualFallbackExecutionContext,
  validateOpenVisualFallbackContract,
}=require(path.join(productRoot,"app","visual-fallback-execution-context.js"));
const {
  SEMANTIC_RESULT_CODES,
}=require(path.join(productRoot,"app","semantic-visual-fallback-eligibility.js"));

const intent={intent:"OPEN",target:"OPEN ME"};
const state={currentApp:"FixtureApp",snapshot:'@e1 button "Other"',changed:false};

function directContext() {
  return {
    visualFallback:{
      provider:{id:"p5e.fake",locality:"local",capabilities:["text-region"],observe:()=>({})},
      targetQuery:{kind:"text",match:"exact",text:"OPEN ME"},
      actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
      policy:{allowVisualFallback:true},
      postcondition:{kind:"text",match:"exact",text:"DONE"},
      observeAfterDelivery:()=>({ok:true}),
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

test("P5E resolves lazy visual context only after an eligible semantic gap",async()=>{
  for (const scenario of ["semantic-success","ineligible","eligible"]) {
    const order=[];
    let resolverCalls=0;
    let visualCalls=0;
    const executionContext={
      resolveVisualFallbackContext:()=>{
        resolverCalls++;
        order.push("resolver");
        return {
          ok:true,
          executionContext:directContext(),
          metadata:{
            provider:{id:"p5e.fake",locality:"local",capabilities:["text-region"]},
            selection:{method:"test"},
          },
        };
      },
    };

    const semanticResult = scenario === "semantic-success"
      ? {ok:true,currentApp:"FixtureApp",snapshot:"after",changed:true}
      : scenario === "ineligible"
        ? {ok:false,code:SEMANTIC_RESULT_CODES.SEMANTIC_ACTION_DELIVERY_FAILED,error:"delivery failed"}
        : {ok:false,code:SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET,error:"missing"};

    const result=await executeOpenSemanticFirst({
      intent,
      state,
      executionContext,
      executeSemanticOpen:async()=>{order.push("semantic");return semanticResult;},
    },{
      runVisualFallback:visual=>{
        visualCalls++;
        order.push("visual");
        assert.equal(visual.targetQuery.text,"OPEN ME");
        return verifiedVisualResult();
      },
    });

    if (scenario === "semantic-success") {
      assert.deepEqual(order,["semantic"]);
      assert.equal(resolverCalls,0);
      assert.equal(visualCalls,0);
      assert.equal(result.executionPath,"semantic");
    } else if (scenario === "ineligible") {
      assert.deepEqual(order,["semantic"]);
      assert.equal(resolverCalls,0);
      assert.equal(visualCalls,0);
      assert.equal(result.visualFallbackEligibility.eligible,false);
    } else {
      assert.deepEqual(order,["semantic","resolver","visual"]);
      assert.equal(resolverCalls,1);
      assert.equal(visualCalls,1);
      assert.equal(result.ok,true);
      assert.equal(result.executionPath,"visual-fallback");
      assert.equal(result.visualFallbackEligibility.code,SEMANTIC_RESULT_CODES.NO_SEMANTIC_TARGET);
      assert.equal(result.visualFallbackProviderSelection.provider.id,"p5e.fake");
      assert.equal(result.delivery.controlState,"CLICK_POSTED");
      assert.equal(result.delivery.semanticConsequenceVerified,false);
      assert.equal(result.taskOutcome.state,"VERIFIED_SUCCESS");
    }
  }
});

test("P5E lazy execution context selects provider only when resolved and builds independent post observer",()=>{
  let selectionCalls=0,acquireCalls=0,interpretCalls=0;
  const provider={id:"p5e.local",locality:"local",capabilities:["text-region"],observe:()=>({})};
  const contract={
    intent:"OPEN",
    targetQuery:{kind:"text",match:"exact",text:"OPEN ME"},
    actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
    policy:{allowVisualFallback:true},
    postcondition:{kind:"text",match:"exact",text:"DONE"},
    providerRequest:{capabilities:["text-region"],locality:"local"},
  };

  const lazy=createLazyOpenVisualFallbackExecutionContext(intent,contract,{
    selectProvider:request=>{
      selectionCalls++;
      assert.deepEqual(request.capabilities,["text-region"]);
      assert.equal(request.locality,"local");
      return {
        ok:true,
        provider,
        descriptor:{id:provider.id,locality:"local",capabilities:["text-region"]},
        selection:{method:"capability-locality-id-order",requiredCapabilities:["text-region"],locality:"local"},
      };
    },
    acquireMappedFrame:()=>{acquireCalls++;return {ok:true,state:"VISUAL_FRAME_MAPPED"};},
    interpretFrame:(mapped,selected)=>{
      interpretCalls++;
      assert.equal(mapped.state,"VISUAL_FRAME_MAPPED");
      assert.equal(selected,provider);
      return {ok:true,state:"VISUAL_INTERPRETATION_OBSERVED"};
    },
  });

  assert.equal(selectionCalls,0);
  const resolved=lazy.resolveVisualFallbackContext();
  assert.equal(selectionCalls,1);
  assert.equal(resolved.ok,true);
  assert.equal(resolved.metadata.provider.id,"p5e.local");
  assert.equal(resolved.executionContext.visualFallback.provider,provider);
  assert.equal(acquireCalls,0);
  assert.equal(interpretCalls,0);

  const observed=resolved.executionContext.visualFallback.observeAfterDelivery();
  assert.equal(observed.state,"VISUAL_INTERPRETATION_OBSERVED");
  assert.equal(acquireCalls,1);
  assert.equal(interpretCalls,1);

  assert.equal(Object.hasOwn(contract,"provider"),false);
  assert.equal(JSON.stringify(contract).includes('"x"'),false);
  assert.equal(JSON.stringify(contract).includes('"y"'),false);
});

test("P5E deterministic visual contract fails closed before provider selection",()=>{
  let selectionCalls=0;
  const invalid={
    targetQuery:{kind:"text",match:"exact",text:"OTHER"},
    actionRequest:{kind:"pointer-click",button:"left",display:"primary"},
    policy:{allowVisualFallback:true},
    postcondition:{kind:"text",match:"exact",text:"DONE"},
  };
  const validated=validateOpenVisualFallbackContract(intent,invalid);
  assert.equal(validated.ok,false);
  assert.equal(validated.reason,"VISUAL_TARGET_MUST_MATCH_OPEN_TARGET");

  const lazy=createLazyOpenVisualFallbackExecutionContext(intent,invalid,{
    selectProvider:()=>{selectionCalls++;throw new Error("must not select");},
  });
  const resolved=lazy.resolveVisualFallbackContext();
  assert.equal(resolved.ok,false);
  assert.equal(selectionCalls,0);
});

test("P5E agent-loop wiring keeps planner semantic and provider selection outside planner",()=>{
  const agentSource=fs.readFileSync(path.join(productRoot,"app","agent-loop.js"),"utf8");
  const llmSource=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");
  const contextSource=fs.readFileSync(path.join(productRoot,"app","visual-fallback-execution-context.js"),"utf8");

  assert.match(agentSource,/visual-fallback-execution-context/);
  assert.match(agentSource,/executeIntent\(intent, state, intentExecutionContext\)/);
  assert.match(agentSource,/async function runTask\(task, options = \{\}\)/);
  assert.match(agentSource,/if \(require\.main === module\)/);
  assert.match(agentSource,/visualFallbackContracts/);

  assert.doesNotMatch(agentSource,/perception-provider-manager/);
  assert.match(contextSource,/perception-provider-manager/);
  assert.match(contextSource,/acquireMappedPrimaryVisualFrame/);
  assert.match(contextSource,/interpretMappedVisualFrame/);

  assert.doesNotMatch(llmSource,/visualFallback|allowVisualFallback|targetQuery|postcondition|providerRequest|PERCEPTION_PROVIDER/);
  assert.doesNotMatch(llmSource,/\bx\s*:|\by\s*:/);
});
