#!/usr/bin/env node
"use strict";

const {
  DESKTOP_PLUGIN_METHODS,
  validateDesktopPlugin,
} = require("./computer-control/desktop/contract");
const {loadDesktopPlugin} = require("./computer-control/desktop");

const cases = [
  ["darwin", require("./computer-control/desktop/plugins/macos")],
  ["win32", require("./computer-control/desktop/plugins/windows")],
  ["linux", require("./computer-control/desktop/plugins/linux")],
];

for (const [platform, plugin] of cases) {
  validateDesktopPlugin(plugin, platform);
  const methods = DESKTOP_PLUGIN_METHODS.filter(name => typeof plugin[name] === "function");
  console.log(`${platform}: ${plugin.id} | contract=${methods.length}/${DESKTOP_PLUGIN_METHODS.length}`);
}

const selected = loadDesktopPlugin();
console.log(`selected=${selected.id} platform=${selected.platform}`);
console.log(`capabilities=${JSON.stringify(selected.capabilities())}`);
