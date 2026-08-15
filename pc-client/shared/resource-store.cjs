"use strict";

const { EXTENSION_INSTALL_REGISTRY } = require("./extension-install-registry.cjs");

const RESOURCE_STORE_KINDS = Object.freeze(["skill", "mcp", "connector", "plugin"]);
const RESOURCE_SOURCE_KINDS = Object.freeze([
  "official",
  "reviewed-community",
  "community"
]);
const RESOURCE_SOURCE_CHANNELS = Object.freeze(["official", "community"]);
const RESOURCE_REVIEW_STATUSES = Object.freeze([
  "unreviewed",
  "automated-reviewed",
  "manually-reviewed",
  "rejected"
]);
const RESOURCE_RISK_LEVELS = Object.freeze(["low", "guarded", "unsafe"]);
const RESOURCE_INTAKE_CANDIDATE_FIELDS = new Set([
  "id",
  "sourceKind",
  "reviewStatus",
  "riskLevel",
  "resourceTypes",
  "metadataSnapshot"
]);
const RESOURCE_METADATA_SNAPSHOT_FIELDS = new Set([
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
]);
const RESOURCE_EXTERNAL_REFERENCE_FIELDS = new Set([
  "ratingValue",
  "ratingCount",
  "stars",
  "heat",
  "favorites",
  "installCount",
  "cls"
]);

function normalizeResourceStoreKind(kind) {
  if (!RESOURCE_STORE_KINDS.includes(kind)) {
    throw new Error("resource store kind invalid");
  }
  return kind;
}

function normalizeResourceSourceChannel(channel) {
  if (!["all", ...RESOURCE_SOURCE_CHANNELS].includes(channel)) {
    throw new Error("resource source channel invalid");
  }
  return channel;
}

function resourceSourceChannel(resource) {
  if (resource?.sourceKind === "official") return "official";
  if (["reviewed-community", "community"].includes(resource?.sourceKind)) {
    return "community";
  }
  return null;
}

function resourceReviewStatus(resource) {
  return RESOURCE_REVIEW_STATUSES.includes(resource?.reviewStatus)
    ? resource.reviewStatus
    : "unreviewed";
}

function resourceRiskLevel(resource) {
  return RESOURCE_RISK_LEVELS.includes(resource?.riskLevel)
    ? resource.riskLevel
    : "guarded";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.toString() === value
    );
  } catch {
    return false;
  }
}

function isIsoTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function validateResourceMetadataSnapshot(snapshot) {
  if (
    !isPlainObject(snapshot) ||
    Object.keys(snapshot).some(
      (field) => !RESOURCE_METADATA_SNAPSHOT_FIELDS.has(field)
    ) ||
    !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(snapshot.sourcePlatform || "") ||
    !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(snapshot.discoveredVia || "") ||
    !isCanonicalHttpsUrl(snapshot.sourcePage) ||
    (snapshot.canonicalSource !== undefined &&
      !isCanonicalHttpsUrl(snapshot.canonicalSource)) ||
    (snapshot.originalAuthor !== undefined &&
      (typeof snapshot.originalAuthor !== "string" ||
        !snapshot.originalAuthor ||
        snapshot.originalAuthor.length > 160)) ||
    (snapshot.licenseId !== undefined &&
      !/^[A-Za-z0-9.+-]{1,100}$/.test(snapshot.licenseId)) ||
    (snapshot.sourceRevision !== undefined &&
      !/^[A-Za-z0-9._+/-]{1,128}$/.test(snapshot.sourceRevision)) ||
    !["first-party-verified", "provenance-unresolved"].includes(
      snapshot.provenanceStatus
    ) ||
    (snapshot.provenanceStatus === "first-party-verified" &&
      (!snapshot.canonicalSource ||
        !snapshot.originalAuthor ||
        !snapshot.licenseId ||
        !snapshot.sourceRevision ||
        snapshot.licenseStatus !== "verified")) ||
    typeof snapshot.externalId !== "string" ||
    !snapshot.externalId ||
    snapshot.externalId.length > 160 ||
    !isIsoTimestamp(snapshot.observedAt) ||
    !["unverified", "verified"].includes(snapshot.licenseStatus) ||
    (snapshot.externalReference !== undefined &&
      (!isPlainObject(snapshot.externalReference) ||
        Object.keys(snapshot.externalReference).some(
          (field) => !RESOURCE_EXTERNAL_REFERENCE_FIELDS.has(field)
        ) ||
        !Object.keys(snapshot.externalReference).length ||
        Object.entries(snapshot.externalReference).some(([field, value]) =>
          field === "cls"
            ? typeof value !== "string" || !value || value.length > 100
            : field === "ratingValue"
              ? typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 5
              : !Number.isSafeInteger(value) || value < 0
        )))
  ) {
    throw new Error("resource metadata snapshot invalid");
  }
  return Object.freeze(structuredClone(snapshot));
}

function listResourcesForStore(resources, kind, { sourceChannel = "all" } = {}) {
  kind = normalizeResourceStoreKind(kind);
  sourceChannel = normalizeResourceSourceChannel(sourceChannel);
  return (Array.isArray(resources) ? resources : [])
    .filter(
      (resource) =>
        resource?.resourceTypes?.includes(kind) &&
        (sourceChannel === "all" ||
          resourceSourceChannel(resource) === sourceChannel)
    )
    .sort((left, right) => (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id));
}

function resourceStoreChannelStats(resources, kind) {
  const stats = {
    total: 0,
    official: 0,
    community: 0,
    sourceKinds: {
      official: 0,
      "reviewed-community": 0,
      community: 0
    }
  };
  for (const resource of listResourcesForStore(resources, kind)) {
    stats.total += 1;
    const channel = resourceSourceChannel(resource);
    if (channel) stats[channel] += 1;
    if (RESOURCE_SOURCE_KINDS.includes(resource.sourceKind)) {
      stats.sourceKinds[resource.sourceKind] += 1;
    }
  }
  return stats;
}

function planCanonicalResourceIntake(resources, candidate) {
  if (
    !candidate ||
    !isPlainObject(candidate) ||
    Object.keys(candidate).some(
      (field) => !RESOURCE_INTAKE_CANDIDATE_FIELDS.has(field)
    ) ||
    typeof candidate.id !== "string" ||
    !candidate.id ||
    !RESOURCE_SOURCE_KINDS.includes(candidate.sourceKind) ||
    !RESOURCE_REVIEW_STATUSES.includes(candidate.reviewStatus) ||
    !RESOURCE_RISK_LEVELS.includes(candidate.riskLevel) ||
    !Array.isArray(candidate.resourceTypes) ||
    !candidate.resourceTypes.length ||
    candidate.resourceTypes.some((kind) => !RESOURCE_STORE_KINDS.includes(kind))
  ) {
    throw new Error("resource intake candidate invalid");
  }
  const metadataSnapshot = candidate.metadataSnapshot === undefined
    ? null
    : validateResourceMetadataSnapshot(candidate.metadataSnapshot);
  const existing = (Array.isArray(resources) ? resources : []).find(
    (resource) => resource?.id === candidate.id
  );
  return Object.freeze({
    action: existing ? "update-canonical" : "create-canonical",
    canonicalResourceId: candidate.id,
    sourceChannel: resourceSourceChannel(candidate),
    metadataSnapshot,
    managedBindingEligible:
      candidate.reviewStatus !== "rejected" &&
      candidate.riskLevel !== "unsafe" &&
      candidate.metadataSnapshot?.provenanceStatus !== "provenance-unresolved"
  });
}

function createResourceDraft({ kind, id, order, targetProductId }) {
  kind = normalizeResourceStoreKind(kind);
  if (typeof id !== "string" || !id || !Number.isInteger(order) || order < 0 || typeof targetProductId !== "string" || !targetProductId) {
    throw new Error("resource draft invalid");
  }
  return {
    id,
    enabled: true,
    order,
    name: "新生态资源",
    resourceTypes: [kind],
    description: "请输入生态资源描述。",
    website: "https://example.com",
    tutorial: "https://example.com",
    sourceKind: "community",
    reviewStatus: "unreviewed",
    riskLevel: "guarded",
    sourceProductIds: [],
    targets: [{
      productId: targetProductId,
      compatibility: "protocol-compatible",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    }]
  };
}

function createResourceStore(kind) {
  kind = normalizeResourceStoreKind(kind);
  return Object.freeze({
    kind,
    list: (resources, options) => listResourcesForStore(resources, kind, options),
    create: (input) => createResourceDraft({ ...input, kind })
  });
}

function resourceTargetPresentation(resource, target) {
  const profile = target?.installProfileId
    ? EXTENSION_INSTALL_REGISTRY[target.installProfileId]
    : null;
  const managed = Boolean(
    resourceReviewStatus(resource) !== "rejected" &&
    resourceRiskLevel(resource) !== "unsafe" &&
    profile &&
    profile.extensionId === resource?.id &&
    profile.moduleId === target?.moduleId &&
    profile.hostProductId === target?.productId &&
    profile.capabilities.includes("install") &&
    target?.capabilities?.includes("install")
  );
  const links = [];

  if (target?.capabilities?.includes("website") && resource?.website) {
    links.push({
      kind: "website",
      href: resource.website,
      labelKey: "resources.openWebsite"
    });
  }
  if (resource?.tutorial && resource.tutorial !== resource.website) {
    links.push({
      kind: "tutorial",
      href: resource.tutorial,
      labelKey: "resources.openTutorial"
    });
  }

  return { managed, links };
}

module.exports = {
  RESOURCE_SOURCE_CHANNELS,
  RESOURCE_SOURCE_KINDS,
  RESOURCE_REVIEW_STATUSES,
  RESOURCE_RISK_LEVELS,
  RESOURCE_STORE_KINDS,
  createResourceStore,
  createResourceDraft,
  listResourcesForStore,
  normalizeResourceSourceChannel,
  normalizeResourceStoreKind,
  planCanonicalResourceIntake,
  resourceSourceChannel,
  resourceReviewStatus,
  resourceRiskLevel,
  resourceStoreChannelStats,
  resourceTargetPresentation,
  validateResourceMetadataSnapshot
};
