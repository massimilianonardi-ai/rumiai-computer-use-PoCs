"use strict";

const {unsupported} = require("../contract");

const platform = "linux";

const CAPABILITIES = Object.freeze({
  "application.find":"UNIMPLEMENTED",
  "application.resolve":"UNIMPLEMENTED",
  "application.launch":"UNIMPLEMENTED",
  "application.activate":"UNIMPLEMENTED",
  "application.foreground":"UNIMPLEMENTED",
  "system-settings.resolve":"UNIMPLEMENTED",
  "window.list":"UNIMPLEMENTED",
  "window.current":"UNIMPLEMENTED",
  "window.focus":"UNIMPLEMENTED",
  "window.close":"UNIMPLEMENTED",
  "window.minimize":"UNIMPLEMENTED",
  "window.maximize":"UNIMPLEMENTED",
  "window.restore":"UNIMPLEMENTED",
  "window.move":"UNIMPLEMENTED",
  "window.resize":"UNIMPLEMENTED",
});

function capabilities() { return {...CAPABILITIES}; }
function findApplications() { return unsupported(platform, "findApplications"); }
function resolveApplication() { return unsupported(platform, "resolveApplication"); }
function launchApplication() { return unsupported(platform, "launchApplication"); }
function activateApplication() { return unsupported(platform, "activateApplication"); }
function getForegroundApplication() { return unsupported(platform, "getForegroundApplication"); }
function getSystemSettingsApplication() { return unsupported(platform, "getSystemSettingsApplication"); }
function listWindows() { return unsupported(platform, "listWindows"); }
function getCurrentWindow() { return unsupported(platform, "getCurrentWindow"); }
function focusWindow() { return unsupported(platform, "focusWindow"); }
function closeWindow() { return unsupported(platform, "closeWindow"); }
function minimizeWindow() { return unsupported(platform, "minimizeWindow"); }
function maximizeWindow() { return unsupported(platform, "maximizeWindow"); }
function restoreWindow() { return unsupported(platform, "restoreWindow"); }
function moveWindow() { return unsupported(platform, "moveWindow"); }
function resizeWindow() { return unsupported(platform, "resizeWindow"); }

module.exports = {
  id:"linux",
  platform,
  capabilities,
  findApplications,
  resolveApplication,
  launchApplication,
  activateApplication,
  getForegroundApplication,
  getSystemSettingsApplication,
  listWindows,
  getCurrentWindow,
  focusWindow,
  closeWindow,
  minimizeWindow,
  maximizeWindow,
  restoreWindow,
  moveWindow,
  resizeWindow,
};
