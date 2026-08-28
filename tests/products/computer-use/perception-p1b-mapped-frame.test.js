#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot, "RUMIAI_COMPUTER_USE_ROOT required");
const perception = require(path.join(productRoot,"app","perception.js"));

function captureResult(width=600,height=400) {
  const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x50,0x31,0x42]);
  return {state:"CAPTURED",display:"primary",format:"image/png",width,height,byteCount:bytes.length,dataBase64:bytes.toString("base64"),cursorIncluded:false,observation:{method:"fixture"}};
}
function displayResult({width=1200,height=800,scale=2,rotationDegrees=0,x=0,y=0}={}) {
  return {state:"OBSERVED",displays:[{primary:true,active:true,online:true,bounds:{x,y,width,height},scale,rotationDegrees}]};
}

test("P1B derives a mapped primary frame from stable display observations", () => {
  const observations=[displayResult(),displayResult()];
  let listCalls=0;
  const result=perception.acquireMappedPrimaryVisualFrame({
    listDisplays:()=>observations[listCalls++],
    captureDisplay:()=>captureResult(),
  });
  assert.equal(listCalls,2);
  assert.equal(result.ok,true);
  assert.equal(result.state,"VISUAL_FRAME_MAPPED");
  assert.equal(result.interpretation.state,"NOT_RUN");
  assert.equal(result.actionCoordinateMapping.state,"RESOLVED");
  assert.equal(result.actionCoordinateMapping.validation.state,"IMPLEMENTED");
  assert.deepEqual(result.actionCoordinateMapping.source,{kind:"capture-pixel",origin:"top-left",width:600,height:400});
  assert.deepEqual(result.actionCoordinateMapping.destination,{kind:"primary-display-logical",origin:"top-left",width:1200,height:800});
  assert.deepEqual(result.actionCoordinateMapping.transform.pixelToLogical,{x:2,y:2});
  assert.deepEqual(result.actionCoordinateMapping.transform.logicalToPixel,{x:0.5,y:0.5});
  assert.equal(result.actionCoordinateMapping.transform.rotationDegrees,0);
});

test("P1B maps capture points without invoking an action", () => {
  const mapping={
    state:"RESOLVED",display:"primary",
    source:{kind:"capture-pixel",origin:"top-left",width:600,height:400},
    destination:{kind:"primary-display-logical",origin:"top-left",width:1200,height:800},
    transform:{kind:"axis-aligned-scale",pixelToLogical:{x:2,y:2},logicalToPixel:{x:0.5,y:0.5},rotationDegrees:0},
  };
  assert.deepEqual(perception.mapCapturePointToPrimaryLogical(mapping,{x:75,y:125}),{
    ok:true,state:"MAPPED",point:{x:150,y:250},coordinateSpace:{kind:"primary-display-logical",origin:"top-left"},
  });
  assert.equal(perception.mapCapturePointToPrimaryLogical(mapping,{x:-1,y:0}).error,"CAPTURE_POINT_OUT_OF_BOUNDS");
  assert.equal(perception.mapCapturePointToPrimaryLogical({state:"UNRESOLVED"},{x:1,y:1}).error,"ACTION_COORDINATE_MAPPING_UNRESOLVED");
});

test("P1B fails closed for rotated or unstable primary topology", () => {
  const rotated=perception.acquireMappedPrimaryVisualFrame({listDisplays:()=>displayResult({rotationDegrees:90}),captureDisplay:()=>captureResult()});
  assert.equal(rotated.error,"PRIMARY_DISPLAY_ROTATION_UNSUPPORTED");

  const observations=[displayResult(),displayResult({width:1199})];
  let i=0;
  const unstable=perception.acquireMappedPrimaryVisualFrame({listDisplays:()=>observations[i++],captureDisplay:()=>captureResult()});
  assert.equal(unstable.error,"PRIMARY_DISPLAY_TOPOLOGY_CHANGED");
});

test("P1A remains unmapped after P1B is added", () => {
  const result=perception.acquirePrimaryVisualFrame({captureDisplay:()=>captureResult()});
  assert.equal(result.state,"VISUAL_FRAME_ACQUIRED");
  assert.equal(result.actionCoordinateMapping.state,"UNRESOLVED");
});
