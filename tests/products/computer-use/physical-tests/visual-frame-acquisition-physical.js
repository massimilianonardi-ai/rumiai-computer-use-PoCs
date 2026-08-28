#!/usr/bin/env node
"use strict";

const path = require("node:path");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
if (!productRoot) {
  console.error("physical-computer-use-perception-p1a=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");
  process.exit(2);
}

const {acquirePrimaryVisualFrame} = require(path.join(productRoot, "app", "perception.js"));

function fail(code, detail = "") {
  console.error(`physical-computer-use-perception-p1a=FAIL code=${code}${detail ? ` detail=${detail}` : ""}`);
  process.exit(1);
}

const result = acquirePrimaryVisualFrame();
if (!result?.ok) {
  const state = result?.state || "FAILED";
  const code = result?.error || "VISUAL_FRAME_ACQUISITION_FAILED";
  if (state === "BLOCKED") {
    console.error(`physical-computer-use-perception-p1a=BLOCKED code=${code}`);
    process.exit(2);
  }
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

console.log(`p1a-real-frame-acquired=PASS width=${frame.width} height=${frame.height} byteCount=${frame.byteCount}`);
console.log(`p1a-real-frame-provenance=PASS methodPresent=${Boolean(result.provenance.observationMethod)}`);
console.log("p1a-real-frame-coordinate-space=PASS kind=capture-pixel mapping=UNRESOLVED");
console.log("p1a-real-frame-interpretation=PASS state=NOT_RUN candidates=0");
console.log("p1a-real-frame-persistence=PASS policy=EPHEMERAL persistedByComputerUse=false");
console.log("p1a-real-frame-payload-logging=PASS payloadLogged=false");
console.log("physical-computer-use-perception-p1a=PASS");
