"use strict";

/*
 * RumiAI Desktop Plugin Contract
 *
 * Computer Control owns the stable WHAT contract.
 * The selected desktop plugin owns every platform-specific HOW detail.
 * A plugin may combine native APIs, accessibility APIs, hotkeys, helper
 * processes or other mechanisms; callers must not depend on those choices.
 */

const DESKTOP_PLUGIN_METHODS = Object.freeze([
  "capabilities",
  "findApplications",
  "resolveApplication",
  "launchApplication",
  "activateApplication",
  "getForegroundApplication",
  "getSystemSettingsApplication",
  "listWindows",
  "getCurrentWindow",
  "focusWindow",
  "closeWindow",
  "minimizeWindow",
  "maximizeWindow",
  "restoreWindow",
  "moveWindow",
  "resizeWindow",
]);

function unsupported(platform, operation, detail = "") {
  return {
    ok:false,
    state:"UNSUPPORTED",
    error:"DESKTOP_CAPABILITY_UNAVAILABLE",
    platform,
    operation,
    detail:detail || `${operation} is not implemented by the ${platform} desktop plugin`,
  };
}

function validateDesktopPlugin(plugin, platform) {
  if (!plugin || typeof plugin !== "object") {
    throw new Error(`Invalid desktop plugin for ${platform}: module did not export an object`);
  }

  if (!plugin.id || !plugin.platform) {
    throw new Error(`Invalid desktop plugin for ${platform}: id and platform are required`);
  }

  if (plugin.platform !== platform) {
    throw new Error(
      `Desktop plugin platform mismatch: requested ${platform}, plugin declares ${plugin.platform}`
    );
  }

  for (const method of DESKTOP_PLUGIN_METHODS) {
    if (typeof plugin[method] !== "function") {
      throw new Error(`Desktop plugin ${plugin.id} does not implement ${method}()`);
    }
  }

  return plugin;
}

module.exports = {
  DESKTOP_PLUGIN_METHODS,
  unsupported,
  validateDesktopPlugin,
};
