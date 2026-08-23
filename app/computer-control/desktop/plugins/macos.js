"use strict";

const agentCtrl = require("../../backends/agent-ctrl");
const macosNative = require("../../backends/macos-native");
const {unsupported} = require("../contract");

const platform = "darwin";

const CAPABILITIES = Object.freeze({
  "application.find":"DEFERRED",
  "application.resolve":"IMPLEMENTED",
  "application.launch":"IMPLEMENTED",
  "application.activate":"IMPLEMENTED",
  "application.foreground":"IMPLEMENTED",
  "system-settings.resolve":"IMPLEMENTED",
  "window.list":"DEFERRED",
  "window.current":"IMPLEMENTED",
  "window.focus":"DEFERRED",
  "window.close":"DEFERRED",
  "window.minimize":"DEFERRED",
  "window.maximize":"DEFERRED",
  "window.restore":"DEFERRED",
  "window.move":"DEFERRED",
  "window.resize":"DEFERRED",
});

function capabilities() {
  return {...CAPABILITIES};
}

function findApplications() {
  return unsupported(platform, "findApplications");
}

function resolveApplication({provider, exactPath} = {}) {
  if (!provider) {
    return unsupported(platform, "resolveApplication", "provider is required");
  }

  return {
    ok:true,
    state:"RESOLVED",
    platform,
    provider,
    identity:macosNative.resolveApplicationIdentity(provider, exactPath),
  };
}

function launchApplication(application = {}) {
  const exactPath =
    application?.identity?.path ||
    application?.exactPath ||
    application?.path ||
    null;

  return macosNative.launchApplicationBundle(exactPath);
}

function activateApplication(application = {}) {
  const provider = application?.provider || null;
  const identity = application?.identity || null;

  if (!provider) {
    return unsupported(platform, "activateApplication", "provider is required");
  }

  return agentCtrl.switchApplication(provider, identity);
}

function getForegroundApplication() {
  return macosNative.foregroundApplication();
}

function getSystemSettingsApplication() {
  return {
    ok:true,
    state:"RESOLVED",
    platform,
    name:"System Settings",
    aliases:["System Preferences", "Impostazioni di Sistema", "Preferenze di Sistema"],
  };
}

function listWindows() {
  return unsupported(platform, "listWindows");
}

function getCurrentWindow() {
  return agentCtrl.getCurrentWindow();
}

function focusWindow() {
  return unsupported(platform, "focusWindow");
}

function closeWindow() {
  return unsupported(platform, "closeWindow");
}

function minimizeWindow() {
  return unsupported(platform, "minimizeWindow");
}

function maximizeWindow() {
  return unsupported(platform, "maximizeWindow");
}

function restoreWindow() {
  return unsupported(platform, "restoreWindow");
}

function moveWindow() {
  return unsupported(platform, "moveWindow");
}

function resizeWindow() {
  return unsupported(platform, "resizeWindow");
}

module.exports = {
  id:"macos",
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
