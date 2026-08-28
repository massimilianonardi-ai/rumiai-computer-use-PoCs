#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

if(process.platform!=="darwin"){
  console.log("physical-phase10-low-level-fallback-discovery=BLOCKED reason=macos-required");
  process.exit(2);
}

const helper=path.join(__dirname,"helpers/macos-phase10-low-level-discovery.swift");
const binary=path.join(os.tmpdir(),`rumiai-phase10-low-level-discovery-${process.pid}`);
function blocked(reason){console.log(`physical-phase10-low-level-fallback-discovery=BLOCKED reason=${reason}`);process.exit(2);}
function failed(reason){console.log(`physical-phase10-low-level-fallback-discovery=FAIL reason=${reason}`);process.exit(1);}
function pass(label,details=""){console.log(`${label}=PASS${details?` ${details}`:""}`);}

if(!fs.existsSync(helper))blocked("helper-missing");
const compile=spawnSync("/usr/bin/xcrun",["swiftc",helper,"-o",binary,"-framework","AppKit","-framework","ApplicationServices","-framework","CoreGraphics","-framework","ScreenCaptureKit"],{encoding:"utf8",maxBuffer:8*1024*1024});
if((compile.status??1)!==0){console.error(compile.stderr||compile.stdout||"");blocked("helper-compile-failed");}

try{
  const run=spawnSync(binary,[],{encoding:"utf8",maxBuffer:8*1024*1024,timeout:15000});
  if(run.error?.code==="ETIMEDOUT")blocked("helper-timeout");
  let value;
  try{value=JSON.parse(String(run.stdout||"").trim());}catch{failed("helper-invalid-json");}
  if((run.status??1)===2||value?.state==="BLOCKED")blocked(value?.error||"helper-blocked");
  if((run.status??1)!==0||value?.ok!==true||value?.state!=="OBSERVED")failed(value?.error||"helper-failed");
  if(value.method!=="independent-macos-phase10-low-level-discovery")failed("method-mismatch");
  if(value.mutationDelivered!==false||value.screenPermissionRequested!==false)failed("discovery-mutated-or-requested-permission");

  const pointer=value.pointer||{};
  if(pointer.finite!==true)failed("pointer-nonfinite");
  if(pointer.appKitMatchesUnflipped!==true)failed("appkit-unflipped-coordinate-mismatch");
  if(pointer.quartzFlipMatchesMainHeight!==true)failed("quartz-flip-coordinate-mismatch");
  pass("phase10-pointer-coordinate-relation","appKitMatchesUnflipped=true quartzFlipMatchesMainHeight=true");

  const display=value.display||{};
  if(!Number.isInteger(display.activeCount)||display.activeCount<1||display.returnedActiveCount!==display.activeCount)failed("active-display-list-invalid");
  if(display.activeListError!==0||display.activeCountError!==0)failed("active-display-query-error");
  if(!(display.mainBounds?.width>0&&display.mainBounds?.height>0&&display.mainPixelWidth>0&&display.mainPixelHeight>0))failed("main-display-geometry-invalid");
  pass("phase10-display-coordinate-surface",`activeCount=${display.activeCount} logical=${display.mainBounds.width}x${display.mainBounds.height} pixels=${display.mainPixelWidth}x${display.mainPixelHeight}`);

  const eventConstruction=value.eventConstruction||{};
  for(const key of["mouseMove","leftDown","leftUp","rightDown","rightUp","scroll","keyDown","keyUp"])if(eventConstruction[key]!==true)failed(`event-construction-${key}`);
  pass("phase10-synthetic-event-construction","mouse=true scroll=true keyboard=true delivered=false");

  const permissions=value.permissions||{};
  if(typeof permissions.accessibilityTrusted!=="boolean"||typeof permissions.screenCapturePreflight!=="boolean")failed("permission-observation-invalid");
  pass("phase10-permission-observation",`accessibilityTrusted=${permissions.accessibilityTrusted} screenCapturePreflight=${permissions.screenCapturePreflight}`);

  const capture=value.screenCapture||{};
  if(capture.preflight!==permissions.screenCapturePreflight)failed("screen-capture-preflight-mismatch");
  if(capture.modernAPI!=="ScreenCaptureKit.SCScreenshotManager")failed("screen-capture-api-mismatch");
  if(capture.preflight===true){
    if(capture.attempted!==true||capture.available!==true||!(capture.width>0&&capture.height>0))failed(`screen-capture-preflight-granted-but-capture-unavailable:${capture.error||"unknown"}`);
    pass("phase10-screen-capture-probe",`preflight=true available=true api=ScreenCaptureKit pixels=${capture.width}x${capture.height}`);
  }else{
    if(capture.attempted!==false||capture.available!==false||capture.width!==0||capture.height!==0)failed("screen-capture-attempted-without-preflight");
    pass("phase10-screen-capture-probe","preflight=false attempted=false available=false api=ScreenCaptureKit");
  }

  const windows=value.windowMetadata||{};
  if(!Number.isInteger(windows.onScreenNonDesktopCount)||windows.onScreenNonDesktopCount<0)failed("window-metadata-count-invalid");
  pass("phase10-window-metadata-observation",`onScreenNonDesktopCount=${windows.onScreenNonDesktopCount}`);
  pass("phase10-discovery-nonmutating","syntheticInputDelivered=false screenPermissionRequested=false");
  console.log("physical-phase10-low-level-fallback-discovery=PASS");
}finally{
  try{fs.unlinkSync(binary);}catch{}
}
