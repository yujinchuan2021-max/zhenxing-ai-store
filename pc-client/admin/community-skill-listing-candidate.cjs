"use strict";

const crypto = require("node:crypto");

const { defaultReleaseSettings, validatePublication } = require("./config-validation.cjs");
const { sha256, validateCatalog } = require("../shared/catalog.cjs");
const { catalogReleaseSha256 } = require("../shared/catalog-release.cjs");
const { canonicalize } = require("../shared/signed-release.cjs");
const {
  planCanonicalResourceIntake,
  resourceStoreChannelStats,
  resourceTargetPresentation
} = require("../shared/resource-store.cjs");

const FORBIDDEN_FIELDS = new Set([
  "command",
  "args",
  "env",
  "headers",
  "credentials",
  "script",
  "secret",
  "token",
  "endpoint",
  "path",
  "invoke"
]);

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function visit(value) {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  for (const [field, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(field)) {
      throw new Error(`community Skill candidate contains forbidden field: ${field}`);
    }
    visit(child);
  }
}

function targetTuple(resourceId, target) {
  return [
    resourceId,
    target.productId,
    target.compatibility,
    target.moduleId,
    target.installProfileId,
    ...(target.capabilities || []),
    String(target.enabled)
  ].join("|");
}

function countTargets(resources) {
  return resources.reduce((total, resource) => total + resource.targets.length, 0);
}

function createCommunitySkillListingBatch1Candidate({ state, stateRaw, batch, batchRaw }) {
  if (!state || !state.draft || !batch || !Array.isArray(batch.readyResources)) {
    throw new TypeError("community Skill listing inputs are invalid");
  }
  const source = batch.sourceOfTruth;
  const baseline = structuredClone(state.draft.catalog);
  const products = baseline.vendors.flatMap((vendor) => vendor.products);
  const targetCount = countTargets(baseline.resources);
  if (
    state.draft.revision !== source.draftRevision ||
    state.channels?.v2?.activeReleaseId !== source.activeReleaseId ||
    state.channels.v2.activeCatalogVersion !== source.activeCatalogVersion ||
    products.length !== source.baseline.products ||
    baseline.resources.length !== source.baseline.resources ||
    targetCount !== source.baseline.targets ||
    resourceStoreChannelStats(baseline.resources, "skill").total !== source.baseline.skillResources
  ) {
    throw new Error("community Skill listing source state drifted");
  }

  const candidateCatalog = structuredClone(baseline);
  const changes = [];
  const ids = new Set();
  const tuples = new Set();
  for (const item of batch.readyResources) {
    const plan = planCanonicalResourceIntake(candidateCatalog.resources, item.intakeCandidate);
    if (plan.action !== "create-canonical" || plan.canonicalResourceId !== item.resourceId) {
      throw new Error(`community Skill listing canonical resource drifted: ${item.resourceId}`);
    }
    const resource = {
      ...structuredClone(item.proposedResource),
      metadataSnapshot: structuredClone(plan.metadataSnapshot)
    };
    visit(resource);
    if (
      resource.sourceKind !== "reviewed-community" ||
      resource.reviewStatus !== "manually-reviewed" ||
      resource.riskLevel !== "guarded" ||
      resource.targets.some(
        (target) =>
          target.moduleId !== "resource-link" ||
          target.installProfileId !== "" ||
          target.capabilities.length !== 1 ||
          target.capabilities[0] !== "website" ||
          resourceTargetPresentation(resource, target).managed
      )
    ) {
      throw new Error(`community Skill listing is not link-only: ${resource.id}`);
    }
    if (ids.has(resource.id)) throw new Error(`duplicate proposed resource: ${resource.id}`);
    ids.add(resource.id);
    for (const target of resource.targets) {
      const tuple = targetTuple(resource.id, target);
      if (tuples.has(tuple)) throw new Error(`duplicate proposed target: ${tuple}`);
      tuples.add(tuple);
    }
    candidateCatalog.resources.push(resource);
    changes.push({
      resourceId: resource.id,
      action: plan.action,
      resourceJsonSha256: hash(JSON.stringify(resource)),
      resource
    });
  }

  const validatedCatalog = validateCatalog(candidateCatalog);
  validatePublication(validatedCatalog, defaultReleaseSettings());
  const skillStats = resourceStoreChannelStats(validatedCatalog.resources, "skill");
  if (
    changes.length !== 14 ||
    tuples.size !== 42 ||
    validatedCatalog.resources.length !== 160 ||
    countTargets(validatedCatalog.resources) !== 555 ||
    skillStats.total !== 30 ||
    skillStats.community !== 14
  ) {
    throw new Error("community Skill listing candidate counts are invalid");
  }
  if (
    JSON.stringify(validatedCatalog.vendors) !== JSON.stringify(baseline.vendors) ||
    JSON.stringify(validatedCatalog.resourceStores) !== JSON.stringify(baseline.resourceStores) ||
    JSON.stringify(validatedCatalog.resources.slice(0, baseline.resources.length)) !==
      JSON.stringify(baseline.resources)
  ) {
    throw new Error("community Skill listing modified an existing catalog record");
  }

  return Object.freeze({
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    generatedAt: batch.generatedAt,
    title: "Community Skill Store Batch 1 canonical merge staging candidate",
    source: {
      draftRevision: state.draft.revision,
      v2ActiveCatalogVersion: state.channels.v2.activeCatalogVersion,
      v2ActiveReleaseId: state.channels.v2.activeReleaseId,
      stateSha256: hash(stateRaw),
      sourceCandidateSha256: hash(batchRaw),
      baselineCatalogJsonSha256: hash(JSON.stringify(baseline)),
      baselineCatalogCanonicalSha256: catalogReleaseSha256(baseline),
      productCount: products.length,
      resourceCount: baseline.resources.length,
      targetCount,
      resourceStoreCount: baseline.resourceStores.length
    },
    proposedChanges: changes,
    summary: {
      resourceDelta: changes.length,
      targetDelta: tuples.size,
      managedTargetDelta: 0,
      agentBindingDelta: 0,
      workflowDependencyDelta: 0,
      candidateResourceCount: validatedCatalog.resources.length,
      candidateTargetCount: countTargets(validatedCatalog.resources),
      candidateSkillStats: skillStats,
      candidateCatalogJsonSha256: hash(JSON.stringify(validatedCatalog)),
      candidateCatalogCanonicalSha256: catalogReleaseSha256(validatedCatalog)
    },
    preservation: {
      metadataSnapshot: "catalog resource metadataSnapshot is retained byte-for-value through validation and canonical signing",
      permittedFields: [
        "sourcePlatform",
        "discoveredVia",
        "sourcePage",
        "canonicalSource",
        "originalAuthor",
        "licenseId",
        "sourceRevision",
        "provenanceStatus",
        "externalId",
        "observedAt",
        "licenseStatus",
        "externalReference"
      ],
      grantsManagedInstall: false,
      grantsAgentBinding: false,
      grantsWorkflowDependency: false
    },
    consumptionPrerequisites: [
      "Re-read the exact draft revision and v2 active release before any separately authorized save.",
      "Keep all targets resource-link with no install profile and website-only capability.",
      "Run full catalog validation, publication validation, and an independently authorized signing flow only after approval.",
      "Never treat metadataSnapshot, reviewStatus, or riskLevel as an installation, Agent, or Workflow authorization."
    ],
    rollback: "No state was written. Discard this candidate; any future authorized state mutation must use the catalog release rollback process, not this file."
  });
}

module.exports = {
  createCommunitySkillListingBatch1Candidate
};
