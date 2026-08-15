"use strict";

const {
  readResponseTextWithLimit
} = require("./limited-response.cjs");

const CLAWHUB_FEED_MAX_BYTES = 2 * 1024 * 1024;
const CLAWHUB_FEED_URLS = Object.freeze({
  skill: "https://clawhub.ai/v1/feeds/skills",
  plugin: "https://clawhub.ai/v1/feeds/plugins"
});

const FEEDS = Object.freeze({
  skill: Object.freeze({ id: "clawhub-official-skills", quota: 80 }),
  plugin: Object.freeze({ id: "clawhub-official", quota: 20 })
});
const FEED_KEYS = Object.freeze([
  "schemaVersion",
  "id",
  "generatedAt",
  "sequence",
  "expiresAt",
  "description",
  "entries"
]);
const ENTRY_KEYS = Object.freeze([
  "type",
  "id",
  "title",
  "description",
  "version",
  "state",
  "featured",
  "publisher",
  "install"
]);
const PUBLISHER_KEYS = Object.freeze(["id", "trust"]);
const ARTIFACT_KEYS = Object.freeze([
  "schemaVersion",
  "sourceId",
  "classification",
  "discoveryOnly",
  "candidateOnly",
  "publishable",
  "resources",
  "reviewLedger"
]);
const REVIEW_LEDGER_KEYS = Object.freeze([
  "resourceKind",
  "registryId",
  "outcome",
  "failureClass",
  "rawVersion"
]);
const RESOURCE_KEYS = Object.freeze([
  "sourceId",
  "feedId",
  "feedGeneratedAt",
  "resourceKind",
  "pluginSubtype",
  "registryId",
  "ownerHandle",
  "publisherTrust",
  "title",
  "summary",
  "latestObservedVersion",
  "state",
  "featured",
  "canonicalUrl",
  "versionLineageStatus",
  "sourceRepo",
  "sourceRef",
  "sourceCommit",
  "sourcePath",
  "sourceProvenance",
  "registryLicense",
  "sourceLicense",
  "classification",
  "candidateOnly",
  "publishable",
  "installProfileId"
]);
const SCOPED_ID = /^@([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)\/([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const VERSION_TOKEN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, keys, label) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${label} schema must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} schema has unexpected fields`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${label} must be an ISO UTC timestamp`);
  }
}

function normalizeIdentity(value, label) {
  if (typeof value !== "string" || value !== value.trim().toLowerCase()) {
    throw new TypeError(`${label} must be normalized lowercase text`);
  }
  const match = SCOPED_ID.exec(value);
  if (!match) {
    throw new TypeError(`${label} must be a scoped registry id`);
  }
  return { id: value, owner: match[1] };
}

function compareIds(left, right) {
  return left.normalized.id < right.normalized.id
    ? -1
    : left.normalized.id > right.normalized.id
      ? 1
      : 0;
}

function versionOutcome(value, label) {
  if (typeof value !== "string" || !VERSION_TOKEN.test(value)) {
    throw new TypeError(`${label} version field is invalid`);
  }
  if (SEMVER.test(value)) {
    return {
      latestObservedVersion: value,
      versionLineageStatus: "feed-latest-only",
      outcome: "discovered-unreviewed",
      failureClass: null,
      rawVersion: null
    };
  }
  return {
    latestObservedVersion: null,
    versionLineageStatus: "metadata-deferred",
    outcome: "metadata-deferred",
    failureClass: "version-invalid",
    rawVersion: value
  };
}

function validateFeed(feed, resourceKind) {
  const contract = FEEDS[resourceKind];
  assertExactKeys(feed, FEED_KEYS, `${resourceKind} feed`);
  if (feed.schemaVersion !== 1 || feed.id !== contract.id) {
    throw new TypeError(`${resourceKind} feed schema identity mismatch`);
  }
  assertIsoTimestamp(feed.generatedAt, `${resourceKind} feed generatedAt`);
  assertIsoTimestamp(feed.expiresAt, `${resourceKind} feed expiresAt`);
  if (!Number.isSafeInteger(feed.sequence) || feed.sequence < 0) {
    throw new TypeError(`${resourceKind} feed sequence must be a non-negative integer`);
  }
  if (typeof feed.description !== "string" || feed.description.trim() === "") {
    throw new TypeError(`${resourceKind} feed description must be non-empty text`);
  }
  if (!Array.isArray(feed.entries) || feed.entries.length < contract.quota) {
    throw new TypeError(`${resourceKind} feed has fewer than ${contract.quota} entries`);
  }

  const seen = new Set();
  const indexed = feed.entries.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new TypeError(`${resourceKind} entry ${index} schema must be an object`);
    }
    if (entry.type !== resourceKind) {
      throw new TypeError(`${resourceKind} entry ${index} has the wrong resource type`);
    }
    const normalized = normalizeIdentity(entry.id, `${resourceKind} entry id`);
    if (seen.has(normalized.id)) {
      throw new TypeError(`${resourceKind} feed contains duplicate registry identity ${normalized.id}`);
    }
    seen.add(normalized.id);
    return { entry, normalized };
  });

  const locked = indexed.sort(compareIds).slice(0, contract.quota);
  for (const lockedEntry of locked) {
    const { entry, normalized } = lockedEntry;
    assertExactKeys(entry, ENTRY_KEYS, `${resourceKind} locked entry ${normalized.id}`);
    if (typeof entry.title !== "string" || entry.title.trim() === "") {
      throw new TypeError(`${normalized.id} title must be non-empty text`);
    }
    if (typeof entry.description !== "string") {
      throw new TypeError(`${normalized.id} description must be text`);
    }
    const version = versionOutcome(entry.version, normalized.id);
    if (entry.state !== "available") {
      throw new TypeError(`${normalized.id} must be available`);
    }
    if (typeof entry.featured !== "boolean") {
      throw new TypeError(`${normalized.id} featured must be boolean`);
    }
    assertExactKeys(entry.publisher, PUBLISHER_KEYS, `${normalized.id} publisher`);
    if (typeof entry.publisher.id !== "string" || entry.publisher.id !== entry.publisher.id.trim().toLowerCase()) {
      throw new TypeError(`${normalized.id} publisher id must be normalized lowercase text`);
    }
    if (entry.publisher.id !== normalized.owner) {
      throw new TypeError(`${normalized.id} publisher scope does not match`);
    }
    if (entry.publisher.trust !== "official") {
      throw new TypeError(`${normalized.id} publisher trust must be official`);
    }
    lockedEntry.version = version;
  }
  return locked.map(({ entry, version }) => ({
    entry,
    version
  }));
}

function discoveryRecord(entry, version, feed, resourceKind) {
  return {
    sourceId: "clawhub",
    feedId: feed.id,
    feedGeneratedAt: feed.generatedAt,
    resourceKind,
    pluginSubtype: null,
    registryId: entry.id.toLowerCase(),
    ownerHandle: entry.publisher.id.toLowerCase(),
    publisherTrust: entry.publisher.trust,
    title: entry.title,
    summary: entry.description,
    latestObservedVersion: version.latestObservedVersion,
    state: entry.state,
    featured: entry.featured,
    canonicalUrl: null,
    versionLineageStatus: version.versionLineageStatus,
    sourceRepo: null,
    sourceRef: null,
    sourceCommit: null,
    sourcePath: null,
    sourceProvenance: "unresolved",
    registryLicense: resourceKind === "skill" ? "MIT-0" : "unknown",
    sourceLicense: "unknown",
    classification: "discovery-only",
    candidateOnly: true,
    publishable: false,
    installProfileId: ""
  };
}

function reviewLedgerRecord(entry, version, resourceKind) {
  return {
    resourceKind,
    registryId: entry.id.toLowerCase(),
    outcome: version.outcome,
    failureClass: version.failureClass,
    rawVersion: version.rawVersion
  };
}

function validateClawHubFirst100(candidate) {
  assertExactKeys(candidate, ARTIFACT_KEYS, "ClawHub artifact");
  if (
    candidate.schemaVersion !== 1 ||
    candidate.sourceId !== "clawhub" ||
    candidate.classification !== "discovery-only" ||
    candidate.discoveryOnly !== true
  ) {
    throw new TypeError("ClawHub artifact identity is invalid");
  }
  if (candidate.candidateOnly !== true) {
    throw new TypeError("ClawHub artifact candidateOnly must be true");
  }
  if (candidate.publishable !== false) {
    throw new TypeError("ClawHub artifact publishable must be false");
  }
  if (!Array.isArray(candidate.resources) || candidate.resources.length !== 100) {
    throw new TypeError("ClawHub artifact must contain exactly 80 Skill and 20 Plugin resources");
  }
  if (!Array.isArray(candidate.reviewLedger) || candidate.reviewLedger.length !== 100) {
    throw new TypeError("ClawHub artifact reviewLedger must contain exactly 100 outcomes");
  }
  const counts = { skill: 0, plugin: 0 };
  const seen = new Set();
  for (const [index, resource] of candidate.resources.entries()) {
    assertExactKeys(resource, RESOURCE_KEYS, `ClawHub resource ${index}`);
    if (resource.resourceKind !== "skill" && resource.resourceKind !== "plugin") {
      throw new TypeError(`ClawHub resource ${index} kind is invalid`);
    }
    counts[resource.resourceKind] += 1;
    const normalized = normalizeIdentity(
      resource.registryId,
      `ClawHub resource ${index} registry id`
    );
    const resourceKey = `${resource.resourceKind}\u0000${normalized.id}`;
    if (seen.has(resourceKey)) {
      throw new TypeError(`ClawHub artifact contains duplicate resource ${normalized.id}`);
    }
    seen.add(resourceKey);
    const outcome = candidate.reviewLedger[index];
    assertExactKeys(outcome, REVIEW_LEDGER_KEYS, `ClawHub review outcome ${index}`);
    if (
      outcome.resourceKind !== resource.resourceKind ||
      outcome.registryId !== normalized.id
    ) {
      throw new TypeError(`${normalized.id} review outcome identity is invalid`);
    }
    if (
      resource.ownerHandle !== normalized.owner ||
      resource.ownerHandle !== resource.ownerHandle?.trim().toLowerCase()
    ) {
      throw new TypeError(`${normalized.id} owner scope is invalid`);
    }
    if (resource.publisherTrust !== "official") {
      throw new TypeError(`${normalized.id} publisher trust must be official`);
    }
    if (
      resource.sourceId !== "clawhub" ||
      resource.feedId !== FEEDS[resource.resourceKind].id ||
      resource.classification !== "discovery-only" ||
      resource.candidateOnly !== true ||
      resource.publishable !== false
    ) {
      throw new TypeError(`${normalized.id} discovery identity is invalid`);
    }
    assertIsoTimestamp(resource.feedGeneratedAt, `${normalized.id} feedGeneratedAt`);
    if (
      typeof resource.title !== "string" ||
      resource.title.trim() === "" ||
      typeof resource.summary !== "string" ||
      resource.state !== "available" ||
      typeof resource.featured !== "boolean" ||
      !(
        outcome.outcome === "discovered-unreviewed" &&
        outcome.failureClass === null &&
        outcome.rawVersion === null &&
        typeof resource.latestObservedVersion === "string" &&
        SEMVER.test(resource.latestObservedVersion) &&
        resource.versionLineageStatus === "feed-latest-only"
      ) && !(
        outcome.outcome === "metadata-deferred" &&
        outcome.failureClass === "version-invalid" &&
        typeof outcome.rawVersion === "string" &&
        VERSION_TOKEN.test(outcome.rawVersion) &&
        !SEMVER.test(outcome.rawVersion) &&
        resource.latestObservedVersion === null &&
        resource.versionLineageStatus === "metadata-deferred"
      )
    ) {
      throw new TypeError(`${normalized.id} discovery facts are invalid`);
    }
    if (resource.installProfileId !== "") {
      throw new TypeError(`${normalized.id} installProfileId must be empty`);
    }
    if (
      resource.canonicalUrl !== null ||
      resource.sourceRepo !== null ||
      resource.sourceRef !== null ||
      resource.sourceCommit !== null ||
      resource.sourcePath !== null
    ) {
      throw new TypeError(`${normalized.id} source fields must remain null`);
    }
    if (resource.sourceProvenance !== "unresolved") {
      throw new TypeError(`${normalized.id} source provenance must remain unresolved`);
    }
    if (resource.sourceLicense !== "unknown") {
      throw new TypeError(`${normalized.id} source license must remain unknown`);
    }
    if (resource.pluginSubtype !== null) {
      const label = resource.resourceKind === "plugin" ? "Plugin" : "Skill";
      throw new TypeError(`${label} subtype must remain null`);
    }
    if (resource.resourceKind === "skill" && resource.registryLicense !== "MIT-0") {
      throw new TypeError("Skill license must be MIT-0");
    }
    if (resource.resourceKind === "plugin" && resource.registryLicense !== "unknown") {
      throw new TypeError("Plugin license must remain unknown");
    }
  }
  if (counts.skill !== 80 || counts.plugin !== 20 || seen.size !== 100) {
    throw new TypeError("ClawHub artifact must contain exactly 80 Skill and 20 Plugin resources");
  }
  return candidate;
}

function composeClawHubFirst100({ skillsFeed, pluginsFeed }) {
  const skills = validateFeed(skillsFeed, "skill");
  const plugins = validateFeed(pluginsFeed, "plugin");
  const locked = [
    ...skills.map((item) => ({ ...item, feed: skillsFeed, resourceKind: "skill" })),
    ...plugins.map((item) => ({ ...item, feed: pluginsFeed, resourceKind: "plugin" }))
  ];
  return validateClawHubFirst100({
    schemaVersion: 1,
    sourceId: "clawhub",
    classification: "discovery-only",
    discoveryOnly: true,
    candidateOnly: true,
    publishable: false,
    resources: locked.map(({ entry, version, feed, resourceKind }) =>
      discoveryRecord(entry, version, feed, resourceKind)
    ),
    reviewLedger: locked.map(({ entry, version, resourceKind }) =>
      reviewLedgerRecord(entry, version, resourceKind)
    )
  });
}

function serializeClawHubFirst100(candidate) {
  return `${JSON.stringify(validateClawHubFirst100(candidate), null, 2)}\n`;
}

async function fetchFeed(fetchImpl, resourceKind) {
  const url = CLAWHUB_FEED_URLS[resourceKind];
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" }
    });
  } catch {
    throw new Error(`ClawHub ${resourceKind} feed request failed`);
  }
  if (!response || !Number.isInteger(response.status)) {
    throw new Error(`ClawHub ${resourceKind} feed response is invalid`);
  }
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new Error(`ClawHub ${resourceKind} feed stopped on HTTP ${response.status}`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`ClawHub ${resourceKind} feed redirect is not allowed`);
  }
  if (response.status !== 200) {
    throw new Error(`ClawHub ${resourceKind} feed returned HTTP ${response.status}`);
  }
  if (response.url !== url) {
    throw new Error(`ClawHub ${resourceKind} feed response URL mismatch`);
  }
  const contentType = String(response.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new Error(`ClawHub ${resourceKind} feed response is not JSON`);
  }
  const text = await readResponseTextWithLimit(response, CLAWHUB_FEED_MAX_BYTES);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`ClawHub ${resourceKind} feed contains invalid JSON`);
  }
}

async function fetchClawHubFirst100({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }
  const skillsFeed = await fetchFeed(fetchImpl, "skill");
  const pluginsFeed = await fetchFeed(fetchImpl, "plugin");
  return composeClawHubFirst100({ skillsFeed, pluginsFeed });
}

module.exports = {
  CLAWHUB_FEED_MAX_BYTES,
  CLAWHUB_FEED_URLS,
  composeClawHubFirst100,
  fetchClawHubFirst100,
  serializeClawHubFirst100,
  validateClawHubFirst100
};
