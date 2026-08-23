"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIR = process.env.RUMIAI_SKILL_DIR || path.join(ROOT, "skills");

const STATUS_ORDER = {
  UNKNOWN: 0,
  PARTIAL: 1,
  VALIDATED: 2,
};

function loadSkills() {
  if (!fs.existsSync(SKILL_DIR)) return [];

  return fs.readdirSync(SKILL_DIR)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => {
      const full = path.join(SKILL_DIR, name);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));

      if (!data.id || !data.provider || !data.realizes || !data.status) {
        throw new Error(`Invalid skill ${name}: id, provider, realizes and status are required`);
      }

      return data;
    });
}

function providerSkills(providerId, skills) {
  return skills.filter(skill => skill.provider === providerId);
}

function deriveCompetence(provider, capabilityId, skills) {
  const capability = provider?.capabilities?.[capabilityId];
  if (!capability) {
    return {
      status: "UNKNOWN",
      required: [],
      validated: [],
      failed: [],
      unknown: [],
      coverage: "0/0",
    };
  }

  const required = Array.isArray(capability.requires_skills)
    ? capability.requires_skills
    : [];

  const availableSkills = providerSkills(provider.id, skills);
  const byRealizes = new Map();

  for (const skill of availableSkills) {
    if (!byRealizes.has(skill.realizes)) byRealizes.set(skill.realizes, []);
    byRealizes.get(skill.realizes).push(skill);
  }

  const validated = [];
  const failed = [];
  const unknown = [];

  for (const requirement of required) {
    const implementations = byRealizes.get(requirement) || [];

    if (implementations.some(skill => skill.status === "VALIDATED")) {
      validated.push(requirement);
    } else if (implementations.some(skill => skill.status === "FAILED")) {
      failed.push(requirement);
    } else {
      unknown.push(requirement);
    }
  }

  let status = "UNKNOWN";

  if (required.length > 0 && validated.length === required.length) {
    status = "VALIDATED";
  } else if (validated.length > 0) {
    status = "PARTIAL";
  }

  return {
    status,
    required,
    validated,
    failed,
    unknown,
    coverage: `${validated.length}/${required.length}`,
  };
}

function competenceRank(competence) {
  return STATUS_ORDER[competence?.status] ?? 0;
}

module.exports = {
  SKILL_DIR,
  STATUS_ORDER,
  loadSkills,
  providerSkills,
  deriveCompetence,
  competenceRank,
};
