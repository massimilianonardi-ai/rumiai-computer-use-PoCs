"use strict";

const path = require("node:path");

const adapterPath = process.env.RUMIAI_COMPUTER_CONTROL_ADAPTER ||
  "/Volumes/RumiAI/rumiai-computer-control/adapters/rumiai/compat.js";

module.exports = require(path.resolve(adapterPath));
