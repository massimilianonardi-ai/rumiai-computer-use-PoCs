#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const targetPath=path.join(productRoot,"app","perception-target.js");
const targetResolver=require(targetPath);

function interpretation(observations) {
  return {
    ok:true,
    state:"VISUAL_INTERPRETATION_OBSERVED",
    interpretation:{
      state:"OBSERVED",
      provider:{id:"fixture",locality:"local",capabilities:["text-region"]},
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
      observations,
      semanticIdentityClaimed:false,
    },
    actionCoordinateMapping:{
      state:"RESOLVED",display:"primary",
      source:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
      destination:{kind:"primary-display-logical",origin:"top-left",width:1200,height:800},
      transform:{kind:"axis-aligned-scale",pixelToLogical:{x:2,y:2},logicalToPixel:{x:0.5,y:0.5},rotationDegrees:0},
      validation:{state:"PHYSICALLY_VALIDATED",scope:"stable-unrotated-primary-display-topology"},
    },
    semanticTarget:{state:"UNRESOLVED"},
    actionPolicy:{state:"NOT_EVALUATED"},
    persistence:{policy:"EPHEMERAL",persistedByComputerUse:false},
  };
}

function observation(text,x=30,y=40,width=120,height=28,confidence=0.9) {
  return {
    kind:"text-region",text,confidence,
    region:{x,y,width,height,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
    semanticIdentity:null,actionable:false,
  };
}

test("P3A resolves exactly one matching text observation into a non-actionable visual target",()=>{
  const result=targetResolver.resolveExactTextTarget(
    interpretation([observation("ALPHA"),observation("BETA",200,100,140,30,0.8)]),
    {kind:"text",match:"exact",text:"BETA"}
  );
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_TARGET_RESOLVED");
  assert.equal(result.semanticTarget.state,"RESOLVED");
  assert.equal(result.semanticTarget.kind,"visual-text-region");
  assert.deepEqual(result.semanticTarget.resolution,{policy:"exact-text-single-match",observationIndex:1});
  assert.deepEqual(result.semanticTarget.capturePoint,{x:270,y:115,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}});
  assert.deepEqual(result.semanticTarget.logicalPoint,{x:540,y:230,coordinateSpace:{kind:"primary-display-logical",origin:"top-left"}});
  assert.equal(result.semanticTarget.semanticIdentity,null);
  assert.equal(result.semanticTarget.actionable,false);
  assert.deepEqual(result.actionPolicy,{state:"NOT_EVALUATED"});
});

test("P3A remains unresolved when no exact text observation matches",()=>{
  const result=targetResolver.resolveExactTextTarget(interpretation([observation("ALPHA")]),{kind:"text",match:"exact",text:"BETA"});
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_TARGET_UNRESOLVED");
  assert.equal(result.semanticTarget.state,"UNRESOLVED");
  assert.equal(result.semanticTarget.reason,"NO_EXACT_TEXT_MATCH");
  assert.equal(result.semanticTarget.matchCount,0);
  assert.equal(result.semanticTarget.actionable,false);
  assert.equal(result.actionPolicy.state,"NOT_EVALUATED");
});

test("P3A fails closed as ambiguous when more than one exact text observation matches",()=>{
  const result=targetResolver.resolveExactTextTarget(interpretation([observation("BETA"),observation("BETA",300,200)]),{kind:"text",match:"exact",text:"BETA"});
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_TARGET_AMBIGUOUS");
  assert.equal(result.semanticTarget.state,"AMBIGUOUS");
  assert.equal(result.semanticTarget.reason,"MULTIPLE_EXACT_TEXT_MATCHES");
  assert.equal(result.semanticTarget.matchCount,2);
  assert.equal(result.semanticTarget.actionable,false);
  assert.equal(result.actionPolicy.state,"NOT_EVALUATED");
});

test("P3A rejects invalid interpretation and invalid query",()=>{
  assert.equal(targetResolver.resolveExactTextTarget({...interpretation([]),state:"OTHER"},{kind:"text",match:"exact",text:"X"}).error,"VISUAL_TARGET_INTERPRETATION_INVALID");
  assert.equal(targetResolver.resolveExactTextTarget(interpretation([]),{kind:"text",match:"contains",text:"X"}).error,"VISUAL_TARGET_QUERY_INVALID");
  assert.equal(targetResolver.resolveExactTextTarget(interpretation([]),{kind:"text",match:"exact",text:"   "}).error,"VISUAL_TARGET_QUERY_INVALID");
});

test("P3A product resolver is deterministic, action-free and persistence-free",()=>{
  const source=fs.readFileSync(targetPath,"utf8");
  assert.match(source,/exact-text-single-match/);
  assert.match(source,/NO_EXACT_TEXT_MATCH/);
  assert.match(source,/MULTIPLE_EXACT_TEXT_MATCHES/);
  assert.match(source,/semanticIdentity:null/);
  assert.match(source,/actionable:false/);
  assert.match(source,/actionPolicy:\{state:"NOT_EVALUATED"\}/);
  assert.match(source,/mapCapturePointToPrimaryLogical/);
  assert.doesNotMatch(source,/movePointer\(|clickPointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);
  assert.doesNotMatch(source,/URLSession|https?:\/\//);
});
