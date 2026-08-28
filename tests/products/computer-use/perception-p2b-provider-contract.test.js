#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");
const providerModulePath=path.join(productRoot,"app","perception-provider.js");
const providerContract=require(providerModulePath);

function mappedFrame() {
  return {
    ok:true,
    state:"VISUAL_FRAME_MAPPED",
    frame:{
      mediaType:"image/png",width:600,height:400,byteCount:12,dataBase64:"iVBORw0KGgoAAA==",cursorIncluded:false,
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
    },
    provenance:{source:"computer-control",operation:"display.capture",display:"primary"},
    actionCoordinateMapping:{
      state:"RESOLVED",display:"primary",
      source:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
      destination:{kind:"primary-display-logical",origin:"top-left",width:1200,height:800},
      transform:{kind:"axis-aligned-scale",pixelToLogical:{x:2,y:2},logicalToPixel:{x:0.5,y:0.5},rotationDegrees:0},
      validation:{state:"PHYSICALLY_VALIDATED",scope:"stable-unrotated-primary-display-topology"},
    },
    interpretation:{state:"NOT_RUN",candidates:[]},
    persistence:{policy:"EPHEMERAL",persistedByComputerUse:false},
  };
}

function provider(overrides={}) {
  return {
    id:"fixture-ocr",
    locality:"local",
    capabilities:["text-region"],
    observe:frame=>({
      state:"OBSERVED",
      coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:frame.width,height:frame.height},
      observations:[{
        kind:"text-region",text:"fixture text",confidence:0.9,
        region:{x:30,y:40,width:120,height:28,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
      }],
    }),
    ...overrides,
  };
}

test("P2B normalizes provider-neutral text-region observations without resolving a target",()=>{
  const result=providerContract.interpretMappedVisualFrame(mappedFrame(),provider());
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_INTERPRETATION_OBSERVED");
  assert.equal(result.interpretation.state,"OBSERVED");
  assert.deepEqual(result.interpretation.provider,{id:"fixture-ocr",locality:"local",capabilities:["text-region"]});
  assert.equal(result.interpretation.semanticIdentityClaimed,false);
  assert.equal(result.interpretation.observations.length,1);
  assert.deepEqual(result.interpretation.observations[0],{
    kind:"text-region",text:"fixture text",confidence:0.9,
    region:{x:30,y:40,width:120,height:28,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}},
    semanticIdentity:null,actionable:false,
  });
  assert.deepEqual(result.semanticTarget,{state:"UNRESOLVED"});
  assert.deepEqual(result.actionPolicy,{state:"NOT_EVALUATED"});
});

test("P2B rejects invalid mapped frames and invalid provider declarations",()=>{
  assert.equal(providerContract.interpretMappedVisualFrame({...mappedFrame(),state:"VISUAL_FRAME_ACQUIRED"},provider()).error,"PERCEPTION_MAPPED_FRAME_INVALID");
  const unvalidated=mappedFrame(); unvalidated.actionCoordinateMapping.validation.state="IMPLEMENTED";
  assert.equal(providerContract.interpretMappedVisualFrame(unvalidated,provider()).error,"PERCEPTION_MAPPED_FRAME_INVALID");
  assert.equal(providerContract.interpretMappedVisualFrame(mappedFrame(),provider({id:""})).error,"PERCEPTION_PROVIDER_INVALID");
  assert.equal(providerContract.interpretMappedVisualFrame(mappedFrame(),provider({capabilities:[]})).error,"PERCEPTION_PROVIDER_INVALID");
});

test("P2B fails closed on provider geometry and observation errors",()=>{
  const wrongGeometry=provider({observe:()=>({state:"OBSERVED",coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:601,height:400},observations:[]})});
  assert.equal(providerContract.interpretMappedVisualFrame(mappedFrame(),wrongGeometry).error,"PERCEPTION_PROVIDER_FRAME_GEOMETRY_MISMATCH");

  const badConfidence=provider({observe:frame=>({state:"OBSERVED",coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:frame.width,height:frame.height},observations:[{kind:"text-region",text:"x",confidence:2,region:{x:1,y:1,width:2,height:2,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}}}]})});
  assert.equal(providerContract.interpretMappedVisualFrame(mappedFrame(),badConfidence).error,"PERCEPTION_CONFIDENCE_INVALID");

  const outOfBounds=provider({observe:frame=>({state:"OBSERVED",coordinateSpace:{kind:"capture-pixel",origin:"top-left",width:frame.width,height:frame.height},observations:[{kind:"text-region",text:"x",confidence:0.5,region:{x:599,y:399,width:2,height:2,coordinateSpace:{kind:"capture-pixel",origin:"top-left"}}}]})});
  assert.equal(providerContract.interpretMappedVisualFrame(mappedFrame(),outOfBounds).error,"PERCEPTION_REGION_OUT_OF_BOUNDS");
});

test("P2B product boundary is provider-neutral, action-free and persistence-free",()=>{
  const source=fs.readFileSync(providerModulePath,"utf8");
  const docs=fs.readFileSync(path.join(productRoot,"docs","perception.md"),"utf8");
  assert.match(source,/capabilities\.includes\("text-region"\)/);
  assert.match(source,/semanticIdentity:null/);
  assert.match(source,/actionable:false/);
  assert.match(source,/semanticTarget:\{state:"UNRESOLVED"\}/);
  assert.match(source,/actionPolicy:\{state:"NOT_EVALUATED"\}/);
  assert.doesNotMatch(source,/Vision|VNRecognizeTextRequest|ScreenCaptureKit/);
  assert.doesNotMatch(source,/movePointer\(|clickPointer\(|dragPointer\(|wheelPointer\(|pressKey\(/);
  assert.doesNotMatch(source,/node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);
  assert.doesNotMatch(source,/URLSession|https?:\/\//);
  assert.match(docs,/P2B[\s\S]*provider-neutral text-region contract/i);
  assert.match(docs,/semanticTarget\.state = "UNRESOLVED"/);
  assert.match(docs,/actionPolicy\.state = "NOT_EVALUATED"/);
});
