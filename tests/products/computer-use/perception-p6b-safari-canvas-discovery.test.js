#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const safariProviderPath=path.join(productRoot,"providers","safari.json");
const manager=require(path.join(productRoot,"app","visual-fallback-contract-manager.js"));

test("P6B candidate uses the existing real Safari application provider",()=>{
  const safari=JSON.parse(fs.readFileSync(safariProviderPath,"utf8"));
  assert.equal(safari.id,"safari");
  assert.equal(safari.name,"Safari");
  assert.equal(safari.kind,"application");
  assert.equal(safari.identity.process,"Safari");
  assert.equal(safari.identity.bundle,"com.apple.Safari");
});

test("P6B discovery does not pre-promote a built-in Safari visual fallback contract",()=>{
  const contracts=manager.loadVisualFallbackContracts();
  const safariContracts=contracts.filter(contract=>String(contract.application).trim().toLowerCase()==="safari");
  assert.equal(safariContracts.length,0);
});

test("P6B keeps caller-contract knowledge separate from provider objects and coordinates",()=>{
  const normalized=manager.normalizeContract({
    id:"p6b.discovery.only",
    application:"Safari",
    intent:"OPEN",
    target:"RUMIAI CLICK 641",
    postcondition:"RUMIAI DONE 902",
    providerRequest:{capabilities:["text-region"],locality:"local"},
  },"p6b-discovery");
  assert.ok(normalized);
  const execution=manager.contractToExecutionContract(normalized);
  assert.equal(execution.policy.allowVisualFallback,true);
  assert.deepEqual(execution.actionRequest,{kind:"pointer-click",button:"left",display:"primary"});
  assert.equal(Object.hasOwn(execution,"provider"),false);
  assert.equal(JSON.stringify(execution).includes('"x"'),false);
  assert.equal(JSON.stringify(execution).includes('"y"'),false);
});

test("P6B remains discovery-only and does not alter P5 planner/provider boundaries",()=>{
  const llm=fs.readFileSync(path.join(productRoot,"app","llm.js"),"utf8");
  const ccExternal=fs.readFileSync(path.join(productRoot,"app","computer-control-external.js"),"utf8");
  assert.doesNotMatch(llm,/visualFallback|allowVisualFallback|targetQuery|postcondition|providerRequest/);
  assert.doesNotMatch(ccExternal,/perception-provider-manager|macos-vision|visual-fallback-contract/);
});
