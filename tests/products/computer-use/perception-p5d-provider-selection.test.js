#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const productRoot = process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot, "RUMIAI_COMPUTER_USE_ROOT required");

const managerPath = path.join(productRoot, "app", "perception-provider-manager.js");
const adapterPath = path.join(productRoot, "app", "perception-providers", "macos-vision.js");
const p2bPath = path.join(productRoot, "app", "perception-provider.js");

const manager = require(managerPath);

function fakeProvider({id, locality="local", capabilities=["text-region"], available=true, onObserve=()=>{}}) {
  return {
    id,
    locality,
    capabilities,
    availability:{check:()=>({available, reason:available ? "TEST_AVAILABLE" : "TEST_UNAVAILABLE"})},
    requirements:{network:locality === "remote", account:false, cloudApi:false},
    observe:frame=>{onObserve(frame); return {state:"OBSERVED", observations:[]};},
  };
}

test("P5D selects an available local provider deterministically without invoking observe",()=>{
  let observeCalls=0;
  const providers=[
    fakeProvider({id:"z.local",onObserve:()=>{observeCalls++;}}),
    fakeProvider({id:"a.local",onObserve:()=>{observeCalls++;}}),
    fakeProvider({id:"m.remote",locality:"remote",onObserve:()=>{observeCalls++;}}),
  ];

  const result=manager.selectPerceptionProvider({capabilities:["text-region"],locality:"local"},{providers});
  assert.equal(result.ok,true);
  assert.equal(result.state,"PERCEPTION_PROVIDER_SELECTED");
  assert.equal(result.descriptor.id,"a.local");
  assert.equal(result.selection.method,"capability-locality-id-order");
  assert.equal(observeCalls,0);
});

test("P5D does not silently fall back from unavailable local provider to remote",()=>{
  const providers=[
    fakeProvider({id:"a.local",available:false}),
    fakeProvider({id:"b.remote",locality:"remote",available:true}),
  ];

  const local=manager.selectPerceptionProvider({capabilities:["text-region"]},{providers});
  assert.equal(local.ok,false);
  assert.equal(local.error,"PERCEPTION_PROVIDER_UNAVAILABLE");

  const remote=manager.selectPerceptionProvider({capabilities:["text-region"],locality:"remote"},{providers});
  assert.equal(remote.ok,true);
  assert.equal(remote.descriptor.id,"b.remote");
});

test("P5D explicit provider selection fails closed on id, capability, locality and availability mismatches",()=>{
  const providers=[
    fakeProvider({id:"local.text",locality:"local",available:true}),
    fakeProvider({id:"remote.text",locality:"remote",available:true}),
    fakeProvider({id:"local.off",locality:"local",available:false}),
  ];

  assert.equal(
    manager.selectPerceptionProvider({providerId:"missing",capabilities:["text-region"],locality:"local"},{providers}).error,
    "PERCEPTION_PROVIDER_ID_NOT_FOUND"
  );
  assert.equal(
    manager.selectPerceptionProvider({providerId:"local.text",capabilities:["object-region"],locality:"local"},{providers}).error,
    "PERCEPTION_PROVIDER_CAPABILITY_UNAVAILABLE"
  );
  assert.equal(
    manager.selectPerceptionProvider({providerId:"remote.text",capabilities:["text-region"],locality:"local"},{providers}).error,
    "PERCEPTION_PROVIDER_LOCALITY_MISMATCH"
  );
  assert.equal(
    manager.selectPerceptionProvider({providerId:"local.off",capabilities:["text-region"],locality:"local"},{providers}).error,
    "PERCEPTION_PROVIDER_UNAVAILABLE"
  );
});

test("P5D requires explicit availability and converts availability exceptions to unavailable",()=>{
  const noAvailability=fakeProvider({id:"no.availability"});
  delete noAvailability.availability;
  const throwing=fakeProvider({id:"throwing"});
  throwing.availability={check:()=>{throw new Error("boom");}};

  const a=manager.describePerceptionProvider(noAvailability);
  const b=manager.describePerceptionProvider(throwing);
  assert.equal(a.availability.available,false);
  assert.equal(a.availability.reason,"EXPLICIT_AVAILABILITY_REQUIRED");
  assert.equal(b.availability.available,false);
  assert.equal(b.availability.reason,"AVAILABILITY_CHECK_FAILED");
});

test("P5D built-in macOS Vision provider is optional local text-region and declares no network/account/cloud requirement",()=>{
  const providers=manager.defaultPerceptionProviders();
  assert.equal(providers.length,1);
  const provider=providers[0];
  assert.equal(provider.id,"rumiai.local.macos-vision-text-region");
  assert.equal(provider.locality,"local");
  assert.deepEqual(provider.capabilities,["text-region"]);
  assert.equal(typeof provider.availability?.check,"function");
  assert.equal(typeof provider.observe,"function");
  assert.equal(provider.requirements?.network,false);
  assert.equal(provider.requirements?.account,false);
  assert.equal(provider.requirements?.cloudApi,false);
});

test("P5D boundary remains Computer Use-owned, separate from application providers and P2B schema",()=>{
  const managerSource=fs.readFileSync(managerPath,"utf8");
  const adapterSource=fs.readFileSync(adapterPath,"utf8");
  const p2bSource=fs.readFileSync(p2bPath,"utf8");

  assert.doesNotMatch(managerSource,/computer-control|agent-ctrl/);
  assert.doesNotMatch(adapterSource,/computer-control|agent-ctrl|https?:\/\//);
  assert.doesNotMatch(managerSource,/provider-manager\.js/);
  assert.match(managerSource,/perception-provider/);
  assert.match(adapterSource,/network:false/);
  assert.match(adapterSource,/account:false/);
  assert.match(adapterSource,/cloudApi:false/);

  assert.match(p2bSource,/interpretMappedVisualFrame/);
  assert.match(p2bSource,/text-region/);
  assert.doesNotMatch(p2bSource,/macos-vision|Vision|swiftc/);
});
