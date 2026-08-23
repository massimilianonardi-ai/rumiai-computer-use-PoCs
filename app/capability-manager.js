"use strict";

const {
  loadProviders,
  providerAvailable,
  explicitProvider,
  providersForCapabilities,
} = require("./provider-manager");

const {
  loadSkills,
  deriveCompetence,
  competenceRank,
} = require("./skill-manager");

function norm(x) {
  return String(x || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function requiredCapabilities(task) {
  const t = norm(task);
  const signals = [
    "documento di testo", "text document",
    "nuovo documento", "new document",
    "scrivi", "write"
  ];

  return signals.some(x => t.includes(x)) ? ["text.edit"] : [];
}

function aggregateCompetence(provider, requiredCapabilities, skills) {
  const perCapability = requiredCapabilities.map(capability => ({
    capability,
    ...deriveCompetence(provider, capability, skills),
  }));

  const allValidated =
    perCapability.length > 0 &&
    perCapability.every(x => x.status === "VALIDATED");

  const anyValidatedSkill =
    perCapability.some(x => x.validated.length > 0);

  const status = allValidated
    ? "VALIDATED"
    : anyValidatedSkill
      ? "PARTIAL"
      : "UNKNOWN";

  const required = perCapability.flatMap(x => x.required);
  const validated = perCapability.flatMap(x => x.validated);
  const failed = perCapability.flatMap(x => x.failed);
  const unknown = perCapability.flatMap(x => x.unknown);

  return {
    status,
    perCapability,
    required,
    validated,
    failed,
    unknown,
    coverage: `${validated.length}/${required.length}`,
  };
}

function selectCapabilityTool(
  task,
  mode = "GOAL",
  exists = undefined,
  providerList = null,
  skillList = null
) {
  const required = requiredCapabilities(task);

  if (!required.length) {
    return {
      required: [],
      candidates: [],
      selectedProvider: null,
      selectedApp: null,
      selectedContextId: null,
      contextIds: [],
      reason: "no capability recognized",
    };
  }

  const providers = providerList || loadProviders();
  const skills = skillList || loadSkills();
  const eligible = providersForCapabilities(required, providers);

  const candidates = eligible.map(provider => {
    const available = exists
      ? providerAvailable(provider, exists)
      : providerAvailable(provider);

    const competence = aggregateCompetence(provider, required, skills);

    return {
      provider,
      available,
      competence,
    };
  }).sort((a, b) =>
    Number(b.available) - Number(a.available) ||
    competenceRank(b.competence) - competenceRank(a.competence) ||
    b.competence.validated.length - a.competence.validated.length ||
    String(a.provider.name).localeCompare(String(b.provider.name))
  );

  const explicit = explicitProvider(task, providers);
  let chosen = null;
  let reason = "";

  if (explicit) {
    const explicitCandidate =
      candidates.find(c => c.provider.id === explicit.id) || null;

    if (explicitCandidate?.available) {
      chosen = explicitCandidate;
      reason = mode === "EXACT"
        ? "EXACT explicit provider"
        : "explicit provider";
    } else if (mode === "EXACT") {
      reason = "EXACT explicit provider unavailable";
    } else {
      chosen = candidates.find(c => c.available) || null;
      reason = chosen
        ? "explicit provider unavailable; fallback to best known available provider"
        : "explicit provider unavailable; no available provider";
    }
  } else {
    chosen = candidates.find(c => c.available) || null;
    reason = chosen
      ? "best derived competence among available providers"
      : "no available provider";
  }

  const selectedProvider = chosen
    ? {
        id: chosen.provider.id,
        name: chosen.provider.name,
        kind: chosen.provider.kind,
        competence: chosen.competence,
      }
    : null;

  const selectedApp =
    chosen?.provider.kind === "application"
      ? chosen.provider.activation?.application || chosen.provider.name
      : null;

  const contextIds = chosen
    ? (Array.isArray(chosen.provider.contexts) ? chosen.provider.contexts : [])
    : [];

  return {
    required,
    candidates: candidates.map(c => ({
      id: c.provider.id,
      name: c.provider.name,
      kind: c.provider.kind,
      available: c.available,
      competence: c.competence,
    })),
    selectedProvider,
    selectedApp,
    selectedContextId:
      contextIds.length ? contextIds[contextIds.length - 1] : null,
    contextIds: [...new Set(contextIds)],
    reason,
  };
}

module.exports = {
  norm,
  requiredCapabilities,
  aggregateCompetence,
  selectCapabilityTool,
};
