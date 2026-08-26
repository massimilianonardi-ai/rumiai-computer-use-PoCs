"use strict";
const assert=require("node:assert/strict");
const path=require("node:path");
const test=require("node:test");
const portableRoot=path.resolve(__dirname,"../../../../../..");
const productRoot=process.env.RUMIAI_COMPUTER_CONTROL_ROOT||path.join(portableRoot,"lib","computer-control");

test("macOS agent-ctrl adapter translates canonical text-area to backend text-field",()=>{
  const dependency=path.join(productRoot,"backends/macos/runtime/app/agent-ctrl.js");
  const wrapper=path.join(productRoot,"backends/macos/runtime/app/computer-control/backends/agent-ctrl.js");
  const dependencyKey=require.resolve(dependency);
  const wrapperKey=require.resolve(wrapper);
  const previousDependency=require.cache[dependencyKey];
  const previousWrapper=require.cache[wrapperKey];
  let captured=null;
  require.cache[dependencyKey]={
    id:dependencyKey,
    filename:dependencyKey,
    loaded:true,
    exports:{
      AGENT_CTRL:"/tmp/agent-ctrl-fixture",
      exec(args){captured=[...args];return{code:1,seconds:0,stdout:"",stderr:"fixture"};},
      deterministicPointerClick(){return{ok:false,seconds:0,summary:"fixture"};},
    },
  };
  delete require.cache[wrapperKey];
  try{
    const backend=require(wrapperKey);
    backend.findElement("RumiAI Native Selected Text","text-area",true);
    assert.deepEqual(captured,["find","RumiAI Native Selected Text","--role","text-field","--first"]);
  }finally{
    delete require.cache[wrapperKey];
    if(previousWrapper)require.cache[wrapperKey]=previousWrapper;
    if(previousDependency)require.cache[dependencyKey]=previousDependency;else delete require.cache[dependencyKey];
  }
});
