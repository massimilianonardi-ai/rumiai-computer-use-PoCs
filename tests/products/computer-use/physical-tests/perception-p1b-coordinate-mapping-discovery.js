#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");
const {decodePng, largestComponent} = require("../helpers/png-raster");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
if (!productRoot) {
  console.error("physical-computer-use-perception-p1b=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");
  process.exit(2);
}

const perception = require(path.join(productRoot, "app", "perception.js"));
const computerControl = require(path.join(productRoot, "app", "computer-control-external.js"));
const source = path.join(__dirname, "helpers", "macos-perception-p1b-marker-fixture.swift");

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function near(a,b,tolerance) { return Math.abs(a-b) <= tolerance; }
function primaryDisplay(result) {
  if (!result || result.ok === false || result.state !== "OBSERVED" || !Array.isArray(result.displays)) fail("DISPLAY_LIST_INVALID");
  const primaries = result.displays.filter(d => d?.primary === true && d?.active === true && d?.online === true);
  if (primaries.length !== 1) fail("PRIMARY_DISPLAY_AMBIGUOUS");
  const d = primaries[0];
  for (const key of ["x","y","width","height"]) if (!Number.isFinite(Number(d.bounds?.[key]))) fail("PRIMARY_DISPLAY_GEOMETRY_INVALID");
  if (!(d.bounds.width > 0) || !(d.bounds.height > 0)) fail("PRIMARY_DISPLAY_GEOMETRY_INVALID");
  if (!Number.isFinite(Number(d.scale)) || !(d.scale > 0)) fail("PRIMARY_DISPLAY_SCALE_INVALID");
  if (Number(d.rotationDegrees) !== 0) fail("PRIMARY_DISPLAY_ROTATION_UNSUPPORTED_FOR_DISCOVERY");
  return d;
}
function stableDisplay(a,b) {
  return ["x","y","width","height"].every(k => Number(a.bounds[k]) === Number(b.bounds[k])) &&
    Number(a.scale) === Number(b.scale) && Number(a.rotationDegrees) === Number(b.rotationDegrees);
}
function waitForReady(child, timeoutMs=6000) {
  return new Promise((resolve,reject) => {
    let out="", err="";
    const timer=setTimeout(()=>reject(new Error("FIXTURE_READY_TIMEOUT")),timeoutMs);
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data",chunk=>{
      out+=chunk;
      const nl=out.indexOf("\n");
      if(nl>=0){clearTimeout(timer);try{resolve(JSON.parse(out.slice(0,nl)))}catch(e){reject(new Error(`FIXTURE_READY_INVALID:${e.message}`));}}
    });
    child.stderr.on("data",chunk=>{err+=chunk;});
    child.on("exit",code=>{if(code!==null){clearTimeout(timer);reject(new Error(`FIXTURE_EXITED:${code}:${err.trim()}`));}});
  });
}
function stopChild(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode != null) return resolve();
    const timer=setTimeout(()=>{try{child.kill("SIGKILL");}catch{}},1200);
    child.once("exit",()=>{clearTimeout(timer);resolve();});
    try{child.kill("SIGTERM");}catch{clearTimeout(timer);resolve();}
  });
}
function markerPredicate(color) {
  if (color === "magenta") return p => p && Math.min(p.r,p.b) - p.g >= 70 && Math.max(p.r,p.b) >= 130;
  if (color === "cyan") return p => p && Math.min(p.g,p.b) - p.r >= 70 && Math.max(p.g,p.b) >= 130;
  throw new Error("UNKNOWN_MARKER_COLOR");
}
function predictedRect(marker, logicalWidth, logicalHeight, pixelWidth, pixelHeight) {
  const sx = pixelWidth / logicalWidth, sy = pixelHeight / logicalHeight;
  return {x:marker.x*sx,y:marker.y*sy,width:marker.width*sx,height:marker.height*sy};
}
function markerPresent(observed) { return Boolean(observed && observed.area >= 700); }
function assertRect(observed, predicted, tolerance=4) {
  if (!markerPresent(observed)) fail("MARKER_COMPONENT_NOT_FOUND");
  if (!near(observed.x,predicted.x,tolerance) || !near(observed.y,predicted.y,tolerance) ||
      !near(observed.width,predicted.width,tolerance) || !near(observed.height,predicted.height,tolerance)) {
    fail("CAPTURE_LOGICAL_MAPPING_MISMATCH");
  }
}

(async () => {
  let fixture = null;
  let runtimeCleanup = false;
  let tmp = null;
  let outcome = {code:1, marker:"physical-computer-use-perception-p1b=FAIL code=UNEXPECTED"};
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-p1b-"));
    const bin = path.join(tmp, "marker-fixture");
    const compiled = spawnSync("/usr/bin/xcrun", ["swiftc","-parse-as-library",source,"-o",bin], {encoding:"utf8",maxBuffer:8*1024*1024});
    if ((compiled.status ?? 1) !== 0) fail("FIXTURE_COMPILE_FAILED");

    const before = primaryDisplay(computerControl.listDisplays());
    fixture = spawn(bin, [], {stdio:["ignore","pipe","pipe"]});
    const ready = await waitForReady(fixture);
    if (ready?.state !== "READY" || !Array.isArray(ready.markers) || ready.markers.length !== 2) fail("FIXTURE_READY_INVALID");
    if (!near(Number(ready.displayWidth), Number(before.bounds.width), 0.5) || !near(Number(ready.displayHeight), Number(before.bounds.height), 0.5)) fail("FIXTURE_DISPLAY_MISMATCH");

    const acquired = perception.acquirePrimaryVisualFrame();
    if (!acquired?.ok || acquired.state !== "VISUAL_FRAME_ACQUIRED") {
      if (acquired?.state === "BLOCKED") { outcome={code:2,marker:`physical-computer-use-perception-p1b=BLOCKED code=${acquired.error||"CAPTURE_BLOCKED"}`}; return; }
      fail(acquired?.error || "FRAME_ACQUISITION_FAILED");
    }
    if (acquired.actionCoordinateMapping?.state !== "UNRESOLVED") fail("PRODUCT_MAPPING_PREMATURELY_RESOLVED");

    const after = primaryDisplay(computerControl.listDisplays());
    if (!stableDisplay(before, after)) fail("DISPLAY_TOPOLOGY_CHANGED_DURING_DISCOVERY");

    const frame = acquired.frame;
    const bytes = Buffer.from(frame.dataBase64, "base64");
    const raster = decodePng(bytes);
    if (raster.width !== frame.width || raster.height !== frame.height) fail("PNG_DIMENSION_MISMATCH");

    const logicalWidth = Number(before.bounds.width), logicalHeight = Number(before.bounds.height);
    const pixelWidth = frame.width, pixelHeight = frame.height;
    const pixelToLogicalX = logicalWidth / pixelWidth, pixelToLogicalY = logicalHeight / pixelHeight;
    if (!(pixelToLogicalX > 0) || !(pixelToLogicalY > 0)) fail("MAPPING_SCALE_INVALID");

    const detected = ready.markers.map(marker => ({marker, observed:largestComponent(raster, markerPredicate(marker.color))}));
    const magenta = detected.find(x => x.marker.color === "magenta")?.observed || null;
    const cyan = detected.find(x => x.marker.color === "cyan")?.observed || null;
    console.log(`p1b-marker-presence=OBSERVED magentaFound=${markerPresent(magenta)} cyanFound=${markerPresent(cyan)} coordinatesLogged=false`);

    for (const {marker,observed} of detected) {
      const predicted = predictedRect(marker, logicalWidth, logicalHeight, pixelWidth, pixelHeight);
      assertRect(observed, predicted);

      const observedCenterPixel = {x:observed.x + observed.width/2, y:observed.y + observed.height/2};
      const mappedCenterLogical = {x:observedCenterPixel.x*pixelToLogicalX, y:observedCenterPixel.y*pixelToLogicalY};
      const expectedCenterLogical = {x:marker.x+marker.width/2, y:marker.y+marker.height/2};
      const logicalTolerance = 4*Math.max(pixelToLogicalX,pixelToLogicalY);
      if (!near(mappedCenterLogical.x, expectedCenterLogical.x, logicalTolerance) || !near(mappedCenterLogical.y, expectedCenterLogical.y, logicalTolerance)) fail("PIXEL_TO_LOGICAL_CENTER_MISMATCH");
    }

    console.log(`p1b-primary-display-observation=PASS logicalWidth=${logicalWidth} logicalHeight=${logicalHeight}`);
    console.log(`p1b-real-frame-acquired=PASS pixelWidth=${pixelWidth} pixelHeight=${pixelHeight}`);
    console.log("p1b-test-owned-markers=PASS count=2 interactive=false");
    console.log("p1b-marker-detection=PASS count=2 coordinatesLogged=false");
    console.log("p1b-coordinate-orientation=PASS origin=top-left");
    console.log("p1b-coordinate-scale=PASS derivedFromObservations=true identityAssumed=false");
    console.log("p1b-topology-stability=PASS");
    console.log("p1b-product-boundary=PASS mappingState=UNRESOLVED interpretation=NOT_RUN");
    console.log("p1b-payload-policy=PASS persisted=false payloadLogged=false");
    outcome={code:0,marker:"physical-computer-use-perception-p1b=PASS"};
  } catch (error) {
    outcome={code:1,marker:`physical-computer-use-perception-p1b=FAIL code=${error.code||error.message||"UNEXPECTED"}`};
  } finally {
    await stopChild(fixture);
    try {
      const shutdown = computerControl.shutdownRuntime();
      runtimeCleanup = shutdown?.ok !== false;
    } catch { runtimeCleanup = false; }
    if (tmp) { try { fs.rmSync(tmp,{recursive:true,force:true}); } catch {} }
    console.log(`p1b-runtime-cleanup=${runtimeCleanup?"PASS":"FAIL"}`);
    if (!runtimeCleanup && outcome.code===0) outcome={code:1,marker:"physical-computer-use-perception-p1b=FAIL code=RUNTIME_CLEANUP_FAILED"};
    console.log(outcome.marker);
    process.exitCode=outcome.code;
  }
})();
