"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const explicitAdapter = process.env.RUMIAI_COMPUTER_CONTROL_ADAPTER;
const installationHome = process.env.RUMIAI_COMPUTER_CONTROL_HOME;
const defaultHome = path.join(
  os.userInfo().homedir,
  ".local",
  "lib",
  "rumiai-computer-control",
  "current"
);
const adapterPath = explicitAdapter || path.join(
  installationHome || defaultHome,
  "adapters",
  "rumiai",
  "compat.js"
);

if (!fs.existsSync(adapterPath)) {
  throw new Error(
    `RumiAI Computer Control adapter not found: ${adapterPath}. ` +
    "Install rumiai-computer-control v0.8.0 or set RUMIAI_COMPUTER_CONTROL_HOME."
  );
}

module.exports = require(path.resolve(adapterPath));
