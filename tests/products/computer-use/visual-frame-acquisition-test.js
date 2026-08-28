"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const portableRoot = path.resolve(__dirname, "../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT || path.join(portableRoot, "app", "computer-use");
const perceptionPath = path.join(productRoot, "app", "perception.js");
const docsPath = path.join(productRoot, "docs", "perception.md");
const {acquirePrimaryVisualFrame, validateCapturedPng} = require(perceptionPath);

function pngPayload() {
  return Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x50,0x31,0x41]);
}

function captureResult(overrides = {}) {
  const bytes = pngPayload();
  return {
    state:"CAPTURED",
    display:"primary",
    format:"image/png",
    width:320,
    height:200,
    byteCount:bytes.length,
    dataBase64:bytes.toString("base64"),
    cursorIncluded:false,
    observation:{method:"fixture-capture"},
    ...overrides,
  };
}

test("P1A acquires one exact primary visual frame through injected Computer Control capture", () => {
  const calls = [];
  const capture = captureResult();
  const result = acquirePrimaryVisualFrame({captureDisplay:params => { calls.push(params); return capture; }});

  assert.deepEqual(calls, [{display:"primary"}]);
  assert.equal(result.ok, true);
  assert.equal(result.state, "VISUAL_FRAME_ACQUIRED");
  assert.equal(result.frame.mediaType, "image/png");
  assert.equal(result.frame.width, 320);
  assert.equal(result.frame.height, 200);
  assert.equal(result.frame.byteCount, capture.byteCount);
  assert.equal(result.frame.dataBase64, capture.dataBase64);
  assert.deepEqual(result.frame.coordinateSpace, {kind:"capture-pixel", origin:"top-left", width:320, height:200});
  assert.deepEqual(result.provenance, {
    source:"computer-control",
    operation:"display.capture",
    display:"primary",
    captureState:"CAPTURED",
    observationMethod:"fixture-capture",
  });
  assert.deepEqual(result.interpretation, {state:"NOT_RUN", candidates:[]});
  assert.equal(result.actionCoordinateMapping.state, "UNRESOLVED");
  assert.equal(result.persistence.policy, "EPHEMERAL");
  assert.equal(result.persistence.persistedByComputerUse, false);
});

test("P1A rejects malformed capture payload/state instead of inventing perception", () => {
  assert.equal(validateCapturedPng(captureResult({state:"OTHER"})).error, "VISUAL_FRAME_INVALID_CAPTURE_STATE");
  assert.equal(validateCapturedPng(captureResult({display:"secondary"})).error, "VISUAL_FRAME_INVALID_DISPLAY");
  assert.equal(validateCapturedPng(captureResult({format:"image/jpeg"})).error, "VISUAL_FRAME_INVALID_FORMAT");
  assert.equal(validateCapturedPng(captureResult({width:0})).error, "VISUAL_FRAME_INVALID_WIDTH");
  assert.equal(validateCapturedPng(captureResult({byteCount:999})).error, "VISUAL_FRAME_BYTE_COUNT_MISMATCH");
  assert.equal(validateCapturedPng(captureResult({dataBase64:"not-base64"})).error, "VISUAL_FRAME_NON_CANONICAL_BASE64");
  const badSignature = Buffer.from("abcdefghijk");
  assert.equal(validateCapturedPng(captureResult({byteCount:badSignature.length,dataBase64:badSignature.toString("base64")})).error, "VISUAL_FRAME_INVALID_PNG_SIGNATURE");
});

test("P1A propagates Computer Control BLOCKED/FAILED state without fallback capture", () => {
  const result = acquirePrimaryVisualFrame({captureDisplay:() => ({ok:false,state:"BLOCKED",error:"SCREEN_CAPTURE_PERMISSION_REQUIRED",detail:"permission missing",recoveryPolicy:"NONE"})});
  assert.deepEqual(result, {ok:false,state:"BLOCKED",error:"SCREEN_CAPTURE_PERMISSION_REQUIRED",detail:"permission missing",recoveryPolicy:"NONE"});
});

test("P1A source and docs preserve perception/action separation", () => {
  const source = fs.readFileSync(perceptionPath, "utf8");
  const docs = fs.readFileSync(docsPath, "utf8");

  assert.match(source, /require\("\.\/computer-control-external"\)\.captureDisplay/);
  assert.match(source, /operation:"display\.capture"/);
  assert.match(source, /kind:"capture-pixel"/);
  assert.match(source, /state:"NOT_RUN"/);
  assert.match(source, /state:"UNRESOLVED"/);
  assert.match(source, /policy:"EPHEMERAL"/);
  assert.doesNotMatch(source, /ScreenCaptureKit|CGDisplayCreateImage|CGWindowListCreateImage|screencapture/);
  assert.doesNotMatch(source, /clickPointer|movePointer|dragPointer|wheelPointer|pressKey/);
  assert.doesNotMatch(source, /node:fs|require\(["']fs["']\)|writeFile|writeFileSync|createWriteStream/);

  assert.match(docs, /does not assume these coordinate spaces are identical/i);
  assert.match(docs, /not directly executable/i);
  assert.match(docs, /performs no OCR, object detection, icon recognition, target ranking or semantic inference/i);
  assert.match(docs, /structured semantic Computer Control observation\/action when available/i);
  assert.match(docs, /does not itself write screenshots/i);
});
