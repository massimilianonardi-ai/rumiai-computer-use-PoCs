#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const callerContext=require(path.join(productRoot,"app","visual-fallback-caller-context.js"));
const {createContextSession}=require(path.join(productRoot,"app","context-manager.js"));

function read(rel){return fs.readFileSync(path.join(productRoot,rel),"utf8");}
function json(rel){return JSON.parse(read(rel));}

const pulsarProvider=json("providers/pulsar.json");
const skillDir=path.join(productRoot,"skills");
const skills=fs.readdirSync(skillDir)
  .filter(name=>name.endsWith(".json"))
  .sort()
  .map(name=>JSON.parse(fs.readFileSync(path.join(skillDir,name),"utf8")));

const agentSource=read("app/agent-loop.js");
const contextSource=read("app/context-manager.js");
const executorSource=read("app/executors.js");
const llmSource=read("app/llm.js");
const callerSource=read("app/visual-fallback-caller-context.js");

test("P8A confirms no current Pulsar skill or capability owns an existing document path",()=>{
  const textEdit=pulsarProvider.capabilities?.["text.edit"];
  assert.ok(textEdit);
  assert.deepEqual(textEdit.requires_skills,["application.activate","document.new","text.insert"]);
  assert.equal(Object.hasOwn(pulsarProvider.capabilities||{},"document.open"),false);

  const pulsarSkills=skills.filter(skill=>skill.provider==="pulsar");
  assert.ok(pulsarSkills.some(skill=>skill.realizes==="document.new"));
  assert.equal(pulsarSkills.some(skill=>skill.realizes==="document.open"),false);
  assert.equal(pulsarSkills.some(skill=>Object.hasOwn(skill,"documentPath")),false);
  assert.equal(pulsarSkills.some(skill=>Object.hasOwn(skill,"filePath")),false);

  const newDocument=pulsarSkills.find(skill=>skill.realizes==="document.new");
  assert.equal(newDocument?.status,"VALIDATED");
  assert.equal(Object.hasOwn(newDocument||{},"path"),false);
});

test("P8A session context tracks application context but does not invent document resource identity",()=>{
  const session=createContextSession();
  const before=session.snapshot();
  assert.equal(Object.hasOwn(before,"documentPath"),false);
  assert.equal(Object.hasOwn(before,"filePath"),false);
  session.observeApp("Pulsar");
  const after=session.snapshot();
  assert.equal(after.currentApp,"Pulsar");
  assert.equal(Object.hasOwn(after,"documentPath"),false);
  assert.equal(Object.hasOwn(after,"filePath"),false);

  assert.doesNotMatch(contextSource,/\bdocumentPath\b/);
  assert.doesNotMatch(contextSource,/\bfilePath\b/);
});

test("P8A default interactive entrypoint supplies no caller-owned document context",()=>{
  assert.match(agentSource,/await runTask\(task\);/);
  assert.match(agentSource,/visualFallbackCallerContext/);
  assert.doesNotMatch(agentSource,/await runTask\(task,\s*\{[^}]*visualFallbackCallerContext/s);

  // The validated P7E API exists, but the default CLI does not fabricate it.
  assert.match(agentSource,/resolveVisualFallbackContractsFromCallerContext/);
});

test("P8A caller-context boundary requires explicit documentPath and performs no UI provenance inference",()=>{
  const missing=callerContext.normalizeCallerContext({kind:"pulsar-document"});
  assert.equal(missing.ok,false);
  assert.equal(missing.error,"VISUAL_FALLBACK_CALLER_CONTEXT_INVALID");

  const explicit=callerContext.normalizeCallerContext({
    kind:"pulsar-document",
    documentPath:"/tmp/example.js",
  });
  assert.equal(explicit.ok,true);
  assert.equal(explicit.context.documentPath,"/tmp/example.js");

  assert.doesNotMatch(callerSource,/computer-control|perception-provider|perception\.js|semantic-ui|snapshot\(|getCurrentWindow|OCR|Vision/i);
});

test("P8A confirms no executor/planner path currently establishes trusted document provenance",()=>{
  assert.doesNotMatch(executorSource,/\bOPEN_DOCUMENT\b|executeOpenDocumentIntent|\bdocumentPath\b|\bfilePath\b/);
  assert.doesNotMatch(llmSource,/\bdocumentPath\b|\bfilePath\b|visualFallbackCallerContext/);
});

test("P8A provenance gap is distinct from P7E visual safety validation",()=>{
  const plan=[
    {id:1,intent:"ACTIVATE_APP",app:"Pulsar"},
    {id:2,intent:"OPEN",target:"UTF-8"},
  ];

  const absent=callerContext.resolveVisualFallbackContractsFromCallerContext(plan,null,{});
  assert.equal(absent.ok,true);
  assert.equal(absent.state,"NO_VISUAL_FALLBACK_CALLER_CONTEXT");
  assert.deepEqual(absent.contracts,[]);

  const explicit=callerContext.resolveVisualFallbackContractsFromCallerContext(
    plan,
    {kind:"pulsar-document",documentPath:"/tmp/example.js"},
    {}
  );
  assert.equal(explicit.ok,true);
  assert.equal(explicit.contracts.length,1);
  assert.equal(explicit.callerContext.kind,"pulsar-document");
  assert.equal(explicit.callerContext.surfaceBinding,"caller-document-path");

  const encoded=JSON.stringify(plan);
  assert.equal(encoded.includes("documentPath"),false);
  assert.equal(encoded.includes("visualFallback"),false);
});
