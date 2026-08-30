#!/usr/bin/env node
"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const productRoot=process.env.RUMIAI_COMPUTER_USE_ROOT;
assert.ok(productRoot,"RUMIAI_COMPUTER_USE_ROOT required");

const resources=require(path.join(productRoot,"app","task-resource-context.js"));
const resourceSource=fs.readFileSync(path.join(productRoot,"app","task-resource-context.js"),"utf8");
const agentSource=fs.readFileSync(path.join(productRoot,"app","agent-loop.js"),"utf8");

function validContext(resourcePath="/tmp/example.js"){
  return {
    version:1,
    resources:[{
      kind:"file",
      role:"current-document",
      application:"Pulsar",
      path:resourcePath,
    }],
  };
}

test("P8B normalizes an explicit caller-owned current-document file resource",()=>{
  const result=resources.normalizeTaskResourceContext(validContext());
  assert.equal(result.ok,true);
  assert.equal(result.state,"TASK_RESOURCE_CONTEXT_NORMALIZED");
  assert.equal(result.context.version,1);
  assert.deepEqual(result.context.resources,[{
    kind:"file",
    role:"current-document",
    application:"Pulsar",
    path:"/tmp/example.js",
  }]);
  assert.equal(Object.isFrozen(result.context),true);
  assert.equal(Object.isFrozen(result.context.resources),true);
  assert.equal(Object.isFrozen(result.context.resources[0]),true);
});

test("P8B fails closed on unsupported versions, relative paths, unsupported resources and oversized contexts",()=>{
  const wrongVersion=resources.normalizeTaskResourceContext({version:2,resources:[]});
  assert.equal(wrongVersion.ok,false);
  assert.equal(wrongVersion.error,"TASK_RESOURCE_CONTEXT_VERSION_UNSUPPORTED");

  const relative=resources.normalizeTaskResourceContext(validContext("relative/example.js"));
  assert.equal(relative.ok,false);
  assert.equal(relative.error,"TASK_RESOURCE_INVALID");

  const unsupported=resources.normalizeTaskResourceContext({
    version:1,
    resources:[{kind:"url",role:"current-document",application:"Pulsar",path:"/tmp/example.js"}],
  });
  assert.equal(unsupported.ok,false);
  assert.equal(unsupported.error,"TASK_RESOURCE_UNSUPPORTED");

  const oversized=resources.normalizeTaskResourceContext({
    version:1,
    resources:Array.from({length:resources.MAX_TASK_RESOURCES+1},(_,i)=>({
      kind:"file",role:"current-document",application:"Pulsar",path:`/tmp/${i}.js`,
    })),
  });
  assert.equal(oversized.ok,false);
  assert.equal(oversized.error,"TASK_RESOURCE_CONTEXT_TOO_LARGE");
});

test("P8B resolves one exact current-document resource and rejects ambiguity",()=>{
  const one=resources.resolveCurrentDocumentResource(validContext(),{application:"Pulsar"});
  assert.equal(one.ok,true);
  assert.equal(one.state,"CURRENT_DOCUMENT_RESOURCE_RESOLVED");
  assert.equal(one.resource.path,"/tmp/example.js");

  const ambiguous=resources.resolveCurrentDocumentResource({
    version:1,
    resources:[
      {kind:"file",role:"current-document",application:"Pulsar",path:"/tmp/a.js"},
      {kind:"file",role:"current-document",application:"Pulsar",path:"/tmp/b.js"},
    ],
  },{application:"Pulsar"});
  assert.equal(ambiguous.ok,false);
  assert.equal(ambiguous.error,"CURRENT_DOCUMENT_RESOURCE_AMBIGUOUS");
});

test("P8B derives only the bounded P7E Pulsar caller context from an explicit Pulsar document resource",()=>{
  const derived=resources.derivePulsarVisualFallbackCallerContextFromTaskResources(validContext("/var/tmp/example.js"));
  assert.equal(derived.ok,true);
  assert.equal(derived.state,"PULSAR_DOCUMENT_CALLER_CONTEXT_DERIVED");
  assert.deepEqual(derived.callerContext,{
    kind:"pulsar-document",
    documentPath:"/var/tmp/example.js",
  });
  assert.deepEqual(derived.resource,{
    kind:"file",
    role:"current-document",
    application:"Pulsar",
  });

  const otherApp=resources.derivePulsarVisualFallbackCallerContextFromTaskResources({
    version:1,
    resources:[{kind:"file",role:"current-document",application:"TextEdit",path:"/tmp/example.txt"}],
  });
  assert.equal(otherApp.ok,true);
  assert.equal(otherApp.state,"NO_PULSAR_DOCUMENT_RESOURCE");
  assert.equal(otherApp.callerContext,null);
});

test("P8B resource provenance boundary performs no UI, perception, planner or filesystem discovery",()=>{
  assert.doesNotMatch(resourceSource,/computer-control|perception-provider|perception\.js|semantic-ui|getCurrentWindow|snapshot\(|OCR|Vision|readFile|existsSync|statSync|realpathSync/i);
  assert.match(resourceSource,/node:path/);
  assert.doesNotMatch(resourceSource,/require\("node:fs"\)/);
});

test("P8B is not yet implicitly wired into the default agent loop or CLI",()=>{
  assert.doesNotMatch(agentSource,/taskResourceContext/);
  assert.match(agentSource,/await runTask\(task\);/);
  assert.match(agentSource,/visualFallbackCallerContext/);
});
