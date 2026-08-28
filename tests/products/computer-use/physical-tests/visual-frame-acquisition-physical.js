#!/usr/bin/env node
"use strict";

const path = require("node:path");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
if (!productRoot) {
  console.error("physical-computer-use-perception-p1a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");
  process.exit(2);
}

const {acquirePrimaryVisualFrame} = require(path.join(productRoot, "app", "perception.js"));
const computerControl = require(path.join(productRoot, "app", "computer-control-external.js"));

class PhysicalOutcome extends Error {
  constructor(kind, code, detail = "") {
    super(code);
    this.kind = kind;
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail = "") {
  throw new PhysicalOutcome("FAIL", code, detail);
}

function blocked(code, detail = "") {
  throw new PhysicalOutcome("BLOCKED", code, detail);
}

function validateFrame(result) {
  if (!result?.ok) {
    const state = result?.state || "FAILED";
    const code = result?.error || "VISUAL_FRAME_ACQUISITION_FAILED";
    if (state === "BLOCKED") blocked(code);
    fail(code);
  }

  const frame = result.frame;
  if (result.state !== "VISUAL_FRAME_ACQUIRED") fail("STATE_MISMATCH");
  if (frame?.mediaType !== "image/png") fail("MEDIA_TYPE_MISMATCH");
  if (!Number.isInteger(frame?.width) || frame.width <= 0) fail("WIDTH_INVALID");
  if (!Number.isInteger(frame?.height) || frame.height <= 0) fail("HEIGHT_INVALID");
  if (!Number.isInteger(frame?.byteCount) || frame.byteCount <= 0) fail("BYTE_COUNT_INVALID");
  if (typeof frame?.dataBase64 !== "string" || !frame.dataBase64) fail("PAYLOAD_MISSING");

  const bytes = Buffer.from(frame.dataBase64, "base64");
  const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (bytes.length !== frame.byteCount) fail("BYTE_COUNT_MISMATCH");
  if (bytes.toString("base64") !== frame.dataBase64) fail("BASE64_NOT_CANONICAL");
  if (bytes.length < signature.length || !bytes.subarray(0, signature.length).equals(signature)) fail("PNG_SIGNATURE_INVALID");

  if (frame.cursorIncluded !== false) fail("CURSOR_POLICY_MISMATCH");
  if (frame.coordinateSpace?.kind !== "capture-pixel" || frame.coordinateSpace?.origin !== "top-left") fail("COORDINATE_SPACE_INVALID");
  if (frame.coordinateSpace?.width !== frame.width || frame.coordinateSpace?.height !== frame.height) fail("COORDINATE_SPACE_DIMENSIONS_INVALID");
  if (result.provenance?.source !== "computer-control" || result.provenance?.operation !== "display.capture" || result.provenance?.display !== "primary" || result.provenance?.captureState !== "CAPTURED") fail("PROVENANCE_INVALID");
  if (result.interpretation?.state !== "NOT_RUN" || !Array.isArray(result.interpretation?.candidates) || result.interpretation.candidates.length !== 0) fail("INTERPRETATION_BOUNDARY_VIOLATED");
  if (result.actionCoordinateMapping?.state !== "UNRESOLVED") fail("ACTION_MAPPING_PREMATURELY_RESOLVED");
  if (result.persistence?.policy !== "EPHEMERAL" || result.persistence?.persistedByComputerUse !== false) fail("PERSISTENCE_BOUNDARY_VIOLATED");

  return frame;
}

let outcome = {kind:"PASS", code:"PASS", detail:""};
let frame = null;
let cleanupOk = false;

try {
  const result = acquirePrimaryVisualFrame();
  frame = validateFrame(result);
} catch (error) {
  if (error instanceof PhysicalOutcome) {
    outcome = {kind:error.kind, code:error.code, detail:error.detail};
  } else {
    outcome = {kind:"FAIL", code:"UNEXPECTED_EXCEPTION", detail:error?.message || String(error)};
  }
} finally {
  try {
    const stopped = computerControl.shutdownRuntime();
    cleanupOk = stopped?.ok !== false && (stopped?.state === "STOPPED" || stopped?.state === "STOPPING" || stopped?.state == null);
  } catch (_) {
    cleanupOk = false;
  }
}

if (!cleanupOk && outcome.kind === "PASS") {
  outcome = {kind:"FAIL", code:"RUNTIME_CLEANUP_FAILED", detail:""};
}

if (outcome.kind !== "PASS") {
  console.error(`p1a-runtime-cleanup=${cleanupOk ? "PASS" : "FAIL"}`);
  console.error(`physical-computer-use-perception-p1a=${outcome.kind} code=${outcome.code}${outcome.detail ? ` detail=${outcome.detail}` : ""}`);
  process.exitCode = outcome.kind === "BLOCKED" ? 2 : 1;
} else {
  console.log(`p1a-real-frame-acquired=PASS width=${frame.width} height=${frame.height} byteCount=${frame.byteCount}`);
  console.log("p1a-real-frame-provenance=PASS methodPresent=true");
  console.log("p1a-real-frame-coordinate-space=PASS kind=capture-pixel mapping=UNRESOLVED");
  console.log("p1a-real-frame-interpretation=PASS state=NOT_RUN candidates=0");
  console.log("p1a-real-frame-persistence=PASS policy=EPHEMERAL persistedByComputerUse=false");
  console.log("p1a-real-frame-payload-logging=PASS payloadLogged=false");
  console.log("p1a-runtime-cleanup=PASS");
  console.log("physical-computer-use-perception-p1a=PASS");
}
