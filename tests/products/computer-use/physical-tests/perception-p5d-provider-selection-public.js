#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
if (!productRoot) {
  console.error("physical-computer-use-perception-p5d=BLOCKED missing RUMIAI_COMPUTER_USE_ROOT");
  process.exit(2);
}

try {
  if (process.platform !== "darwin") {
    throw Object.assign(new Error("MACOS_REQUIRED"), {code:"MACOS_REQUIRED"});
  }

  const manager = require(path.join(productRoot, "app", "perception-provider-manager.js"));
  const concrete = manager.defaultPerceptionProviders();
  assert.equal(concrete.length, 1);

  let observeCalls = 0;
  const realProvider = concrete[0];
  const provider = {
    ...realProvider,
    observe:frame => {
      observeCalls += 1;
      return realProvider.observe(frame);
    },
  };

  const described = manager.describePerceptionProvider(provider);
  if (!described.structurallyValid) {
    throw Object.assign(new Error("PROVIDER_DESCRIPTOR_INVALID"), {code:"PROVIDER_DESCRIPTOR_INVALID"});
  }
  if (!described.availability.available) {
    throw Object.assign(
      new Error(described.availability.reason || "PROVIDER_UNAVAILABLE"),
      {code:"LOCAL_PROVIDER_UNAVAILABLE"}
    );
  }
  if (described.locality !== "local" || !described.capabilities.includes("text-region")) {
    throw Object.assign(new Error("PROVIDER_DESCRIPTOR_MISMATCH"), {code:"PROVIDER_DESCRIPTOR_MISMATCH"});
  }
  if (described.requirements?.network !== false || described.requirements?.account !== false || described.requirements?.cloudApi !== false) {
    throw Object.assign(new Error("PROVIDER_REQUIREMENTS_NOT_LOCAL_ONLY"), {code:"PROVIDER_REQUIREMENTS_NOT_LOCAL_ONLY"});
  }

  const selected = manager.selectPerceptionProvider(
    {capabilities:["text-region"], locality:"local"},
    {providers:[provider]}
  );

  if (!selected.ok || selected.state !== "PERCEPTION_PROVIDER_SELECTED") {
    throw Object.assign(new Error(selected.error || "PROVIDER_SELECTION_FAILED"), {code:"PROVIDER_SELECTION_FAILED"});
  }
  if (selected.descriptor.id !== "rumiai.local.macos-vision-text-region") {
    throw Object.assign(new Error("UNEXPECTED_PROVIDER_SELECTED"), {code:"UNEXPECTED_PROVIDER_SELECTED"});
  }
  if (selected.selection?.method !== "capability-locality-id-order") {
    throw Object.assign(new Error("SELECTION_METHOD_INVALID"), {code:"SELECTION_METHOD_INVALID"});
  }
  if (observeCalls !== 0) {
    throw Object.assign(new Error("SELECTION_INVOKED_OBSERVE"), {code:"SELECTION_INVOKED_OBSERVE"});
  }

  const remoteOnly = {
    id:"p5d.test.remote",
    locality:"remote",
    capabilities:["text-region"],
    availability:{check:()=>({available:true,reason:"TEST_AVAILABLE"})},
    requirements:{network:true,account:false,cloudApi:false},
    observe:()=>{throw new Error("REMOTE_OBSERVE_MUST_NOT_RUN");},
  };
  const localUnavailable = {
    id:"p5d.test.local-unavailable",
    locality:"local",
    capabilities:["text-region"],
    availability:{check:()=>({available:false,reason:"TEST_UNAVAILABLE"})},
    requirements:{network:false,account:false,cloudApi:false},
    observe:()=>{throw new Error("LOCAL_OBSERVE_MUST_NOT_RUN");},
  };

  const noImplicitRemote = manager.selectPerceptionProvider(
    {capabilities:["text-region"]},
    {providers:[localUnavailable, remoteOnly]}
  );
  if (noImplicitRemote.ok || noImplicitRemote.error !== "PERCEPTION_PROVIDER_UNAVAILABLE") {
    throw Object.assign(new Error("IMPLICIT_REMOTE_FALLBACK_DETECTED"), {code:"IMPLICIT_REMOTE_FALLBACK_DETECTED"});
  }

  console.log(`p5d-local-provider-availability=PASS provider=${described.id} locality=${described.locality} availability=${described.availability.state} reason=${described.availability.reason}`);
  console.log(`p5d-provider-selection=PASS capability=text-region locality=local method=${selected.selection.method} observeCalls=${observeCalls}`);
  console.log("p5d-no-implicit-remote=PASS defaultLocality=local remoteFallback=false");
  console.log("p5d-provider-requirements=PASS network=false account=false cloudApi=false");
  console.log("p5d-ocr-independence=PASS frameCapture=false ocrExecuted=false targetResolution=false actionExecution=false");
  console.log("physical-computer-use-perception-p5d=PASS");
} catch (error) {
  console.log(`physical-computer-use-perception-p5d=FAIL code=${error.code || error.message || "UNEXPECTED"}`);
  process.exitCode = 1;
}
