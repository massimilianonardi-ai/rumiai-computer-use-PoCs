"use strict";

const {validateDesktopPlugin} = require("./contract");

const PLUGIN_MODULES = Object.freeze({
  darwin:"./plugins/macos-v75",
  win32:"./plugins/windows",
  linux:"./plugins/linux",
});

function loadDesktopPlugin(platform = process.platform) {
  const modulePath = PLUGIN_MODULES[platform];

  if (!modulePath) {
    throw new Error(`Unsupported desktop platform: ${platform}`);
  }

  return validateDesktopPlugin(require(modulePath), platform);
}

module.exports = {
  PLUGIN_MODULES,
  loadDesktopPlugin,
};
