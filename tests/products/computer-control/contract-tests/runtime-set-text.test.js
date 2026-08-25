"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const portableRoot = path.resolve(__dirname, "../../../../../..");
const productRoot = process.env.RUMIAI_COMPUTER_CONTROL_ROOT || path.join(portableRoot, "lib", "computer-control");
const {createRouter} = require(path.join(productRoot, "runtime/src/router"));
const {createServer} = require(path.join(productRoot, "runtime/src/server"));
const {createMacOSBackend} = require(path.join(productRoot, "backends/macos/backend"));
const {ComputerControlClient} = require(path.join(productRoot, "sdk/typescript/src"));

function mockBackend() {
  let clipboard = "";
  return {
    ensureRuntime:() => ({ok:true, started:true, method:"mock-ready"}),
    ensureReady:async app => ({ok:true, currentApp:app, snapshot:'@e0 text-field "Editor"', method:"mock-app-ready"}),
    getForeground:() => ({ok:true, name:"TextEdit", bundle:"com.apple.TextEdit", pid:123, method:"mock-foreground"}),
    get:({element, property}) => ({ok:true, ref:element.ref, property, value:"Ciao RumiAI.", method:"mock-get"}),
    getBounds:({element}) => ({ok:true, ref:element.ref, bounds:{x:1,y:2,w:3,h:4}, method:"mock-bounds"}),
    focus:() => ({ok:true, verified:true, verificationMethod:"snapshot-ref", method:"mock-focus"}),
    click:() => ({ok:true, method:"mock-click", fallbackUsed:false}),
    press:() => ({ok:true, method:"mock-press"}),
    clear:() => ({ok:true, verified:true, verificationMethod:"ax-text-exact", method:"ax-fill-empty", attempts:[]}),
    clipboardRead:() => ({ok:true, stdout:JSON.stringify(clipboard), method:"mock-clipboard-read"}),
    clipboardWrite:text => { clipboard = text; return {ok:true, method:"mock-clipboard-write"}; },
    clipboardCopy:() => ({ok:true, method:"mock-copy"}),
    clipboardPaste:() => ({ok:true, method:"mock-paste"}),
    waitStable:() => ({ok:true, snapshot:'@e0 text-field "stable"', method:"mock-stable"}),
    waitUntilChanged:async () => ({ok:true, changed:true, snapshot:'@e0 text-field "changed"', method:"mock-changed", attempts:1}),
    listWindows:() => ({ok:true, windows:[{id:"pid:1:window:0",title:"Fixture",process:"TextEdit",pid:1}], method:"mock-list"}),
    getCurrentWindow:() => ({ok:true, window:{id:"pid:1:window:0",title:"Fixture",process:"TextEdit",pid:1}, method:"mock-current"}),
    focusWindow:({window}) => ({ok:true, verified:true, window, verificationMethod:"mock-focus-window", method:"mock-focus-window"}),
    closeWindow:() => ({ok:true, verified:true, verificationMethod:"mock-close-window", method:"mock-close-window"}),
    minimizeWindow:({window}) => ({ok:true, verified:true, window, verificationMethod:"mock-minimize", method:"mock-minimize"}),
    restoreWindow:({window}) => ({ok:true, verified:true, window, verificationMethod:"mock-restore", method:"mock-restore"}),
    maximizeWindow:({window}) => ({ok:true, verified:true, window, verificationMethod:"mock-maximize", method:"mock-maximize"}),
    moveWindow:({window}) => ({ok:true, verified:true, window, bounds:{x:10,y:20,w:100,h:100}, verificationMethod:"mock-move", method:"mock-move"}),
    resizeWindow:({window}) => ({ok:true, verified:true, window, bounds:{x:10,y:20,w:200,h:200}, verificationMethod:"mock-resize", method:"mock-resize"}),
    shutdownRuntime:() => ({ok:true, method:"mock-stopped"}),
    snapshot:() => ({
      ok:true,
      snapshot:'@e0 text-area ""\n@e1 button "Save"',
      changed:null,
      method:"mock-snapshot",
    }),
    describe:({element}) => ({
      ok:true,
      state:"DESCRIBED",
      ref:element.ref,
      role:"text-field",
      name:"Editor",
      description:null,
      value:"Ciao RumiAI.",
      valueType:"string",
      visible:true,
      enabled:true,
      focused:true,
      selected:null,
      checked:null,
      mixed:null,
      expanded:null,
      readOnly:false,
      required:null,
      range:null,
      actions:null,
      childCount:null,
      parentRole:null,
      bounds:{x:1,y:2,width:3,height:4},
      method:"mock-describe",
    }),
    find:({query}) => ({
      ok:true,
      ref:"@e1",
      refs:["@e1"],
      method:"mock-find",
      source:"backend",
      query,
    }),
    setText:({app, element, text, verify}) => ({
      ok:true,
      state:"VERIFIED",
      verified:verify === true,
      verificationMethod:"ax-text-exact",
      observed:text,
      method:"ax-fill",
      attempts:[{method:"ax-fill", action:"DELIVERED", verified:true, verification:"ax-text-exact"}],
      application:app,
      ref:element.ref,
    }),
  };
}

test("runtime.info and ui.setText cross the local RPC boundary", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rumiai-cc-test-"));
  const socketPath = path.join(directory, "runtime.sock");
  const backend = createMacOSBackend({backendModule:mockBackend()});
  const server = createServer({socketPath, route:createRouter(backend)});
  await server.listen();
  t.after(async () => {
    await server.close();
    fs.rmdirSync(directory);
  });

  const client = new ComputerControlClient({socketPath, timeoutMs:2000});
  const info = await client.runtimeInfo();
  assert.equal(info.contractVersion, "0.9.0");
  assert.equal(info.backend.name, "macos-ax");
  assert.equal(info.capabilities.find(item => item.name === "ui.setText").available, true);

  const ready = await client.ensureReady();
  assert.equal(ready.verified, true);

  const appReady = await client.ensureApplicationReady({application:"TextEdit"});
  assert.equal(appReady.application.name, "TextEdit");
  const foreground = await client.getForeground();
  assert.equal(foreground.application.bundle, "com.apple.TextEdit");

  const snapshot = await client.snapshot({application:"TextEdit", settle:true});
  assert.equal(snapshot.state, "OBSERVED");
  assert.equal(snapshot.nodes[0].ref, "@e0");
  assert.equal(snapshot.nodes[0].role, "text-area");

  const described = await client.describe({
    application:"TextEdit",
    target:{ref:"@e0", role:"text-field", name:"Editor"},
  });
  assert.equal(described.state, "DESCRIBED");
  assert.equal(described.target.ref, "@e0");
  assert.equal(described.target.role, "text-field");
  assert.equal(described.value, "Ciao RumiAI.");
  assert.equal(described.valueType, "string");
  assert.equal(described.enabled, true);
  assert.equal(described.checked, null);

  const editable = await client.find({
    application:"TextEdit",
    role:"text-area",
    snapshot:snapshot.snapshot,
  });
  assert.equal(editable.target.ref, "@e0");
  assert.equal(editable.source, "snapshot");

  const value = await client.get({application:"TextEdit", target:editable.target, property:"text"});
  assert.equal(value.value, "Ciao RumiAI.");
  const bounds = await client.getBounds({application:"TextEdit", target:editable.target});
  assert.deepEqual(bounds.bounds, {x:1,y:2,width:3,height:4});
  assert.equal((await client.focus({application:"TextEdit", target:editable.target})).state, "FOCUS_DELIVERED");
  assert.equal((await client.click({application:"TextEdit", target:editable.target})).state, "CLICK_DELIVERED");
  assert.equal((await client.press({application:"TextEdit", keys:"Right"})).state, "KEYS_DELIVERED");
  assert.equal((await client.clear({application:"TextEdit", target:editable.target})).state, "CLEARED");
  await client.writeClipboard("fixture");
  assert.equal((await client.readClipboard()).text, "fixture");
  assert.equal((await client.copy()).state, "COPY_DELIVERED");
  assert.equal((await client.paste()).state, "PASTE_DELIVERED");
  assert.equal((await client.waitStable({application:"TextEdit"})).state, "STABLE");
  assert.equal((await client.waitUntilChanged({application:"TextEdit", previousSnapshot:"before"})).changed, true);
  const windows = await client.listWindows("TextEdit");
  const window = windows.windows[0];
  assert.equal((await client.getCurrentWindow("TextEdit")).window.title, "Fixture");
  assert.equal((await client.focusWindow("TextEdit", window)).state, "FOCUSED");
  assert.equal((await client.minimizeWindow("TextEdit", window)).state, "MINIMIZED");
  assert.equal((await client.restoreWindow("TextEdit", window)).state, "RESTORED");
  assert.equal((await client.maximizeWindow("TextEdit", window)).state, "MAXIMIZED");
  assert.equal((await client.moveWindow("TextEdit", window, {x:10,y:20})).state, "MOVED");
  assert.equal((await client.resizeWindow("TextEdit", window, {width:200,height:200})).state, "RESIZED");
  assert.equal((await client.closeWindow("TextEdit")).state, "CLOSED");

  const result = await client.setText({
    application:"TextEdit",
    target:{ref:"@e0", role:"text-field"},
    text:"Ciao RumiAI.",
  });
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.verification.method, "ax-text-exact");
  assert.equal(result.backend.strategy, "ax-fill");

  const stopped = await client.shutdownRuntime();
  assert.equal(stopped.state, "STOPPED");
});

test("ui.find performs normalized semantic matching over caller observation", async () => {
  const backend = createMacOSBackend({backendModule:mockBackend()});
  const result = await backend.find({
    application:"System Settings",
    query:"Wi-Fi",
    role:"button",
    snapshot:'@e4 button "Wi‑Fi"',
  });
  assert.equal(result.target.ref, "@e4");
  assert.equal(result.source, "snapshot");
});

test("ui.setText rejects empty text without invoking GUI recovery", async () => {
  const backend = createMacOSBackend({backendModule:mockBackend()});
  const route = createRouter(backend);
  await assert.rejects(
    route("ui.setText", {application:"TextEdit", target:{ref:"@e0"}, text:""}),
    error => error.code === "EMPTY_TEXT_REQUIRES_CLEAR" && error.recoveryPolicy === "NONE"
  );
});
