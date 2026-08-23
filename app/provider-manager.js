"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROVIDER_DIR = process.env.RUMIAI_PROVIDER_DIR || path.join(ROOT, "providers");

function norm(x) {
  return String(x || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function expandHome(p) {
  const raw = String(p || "");
  if (raw === "~") return os.homedir();
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

function loadProviders() {
  if (!fs.existsSync(PROVIDER_DIR)) return [];

  return fs.readdirSync(PROVIDER_DIR)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => {
      const full = path.join(PROVIDER_DIR, name);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));

      if (!data.id || !data.name || !data.kind) {
        throw new Error(`Invalid provider ${name}: id, name and kind are required`);
      }

      return data;
    });
}

function providerAvailable(provider, exists = fs.existsSync) {
  const availability = provider?.availability || {};

  if (availability.type === "paths") {
    const paths = Array.isArray(availability.paths) ? availability.paths : [];
    return paths.some(p => exists(expandHome(p)));
  }

  return false;
}

function explicitProvider(task, providers) {
  const t = norm(task);

  const matches = providers.filter(provider => {
    const names = [
      provider.name,
      ...(Array.isArray(provider.aliases) ? provider.aliases : [])
    ].map(norm).filter(Boolean);

    return names.some(name => t.includes(name));
  });

  return matches.sort((a, b) => String(a.name).localeCompare(String(b.name)))[0] || null;
}

function providersForCapabilities(required, providers) {
  return providers.filter(provider => {
    const caps = provider.capabilities || {};
    return required.every(cap => caps[cap]);
  });
}


function providerResolvedPath(provider, exists = fs.existsSync) {
  const availability = provider?.availability || {};
  const paths = availability.type === "paths" && Array.isArray(availability.paths)
    ? availability.paths
    : [];

  for (const raw of paths) {
    const resolved = expandHome(raw);
    if (exists(resolved)) return resolved;
  }

  return null;
}

function providerForApplication(app, providers = loadProviders()) {
  const wanted = norm(app);

  return providers.find(provider => {
    if (provider.kind !== "application") return false;

    const names = [
      provider.name,
      provider.activation?.application,
      ...(Array.isArray(provider.aliases) ? provider.aliases : [])
    ].map(norm).filter(Boolean);

    return names.includes(wanted);
  }) || null;
}


function applicationSpec(name, providers = loadProviders()) {
  const raw = String(name || "").trim();
  const provider = providerForApplication(raw, providers);

  if (!provider) {
    return {
      process:raw,
      bundle:null,
      provider:null,
    };
  }

  return {
    process:
      provider?.identity?.process ||
      provider?.activation?.application ||
      provider.name ||
      raw,
    bundle:provider?.identity?.bundle || null,
    provider,
  };
}

function applicationAliasMap(providers = loadProviders()) {
  const out = {};

  for (const provider of providers) {
    if (provider.kind !== "application") continue;

    const spec = applicationSpec(provider.name, providers);
    const names = [
      provider.name,
      provider.activation?.application,
      provider.identity?.process,
      ...(Array.isArray(provider.aliases) ? provider.aliases : []),
    ].filter(Boolean);

    for (const name of names) {
      out[norm(name)] = {
        process:spec.process,
        bundle:spec.bundle,
        providerId:provider.id,
      };
    }
  }

  return out;
}

function sameApplication(requestedApp, observedApp, providers = loadProviders()) {
  if (!requestedApp || !observedApp) return false;

  const desired = applicationSpec(requestedApp, providers);

  if (desired.bundle && observedApp.bundle) {
    return desired.bundle.toLowerCase() ===
      String(observedApp.bundle).toLowerCase();
  }

  const observedName = String(observedApp.name || "").trim();
  if (!observedName) return false;

  const observedSpec = applicationSpec(observedName, providers);

  return norm(desired.process) === norm(observedSpec.process);
}


module.exports = {
  PROVIDER_DIR,
  norm,
  expandHome,
  loadProviders,
  providerAvailable,
  providerResolvedPath,
  providerForApplication,
  applicationSpec,
  applicationAliasMap,
  sameApplication,
  explicitProvider,
  providersForCapabilities,
};
