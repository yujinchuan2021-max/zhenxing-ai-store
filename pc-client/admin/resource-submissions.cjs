"use strict";

const crypto = require("node:crypto");
const { canonicalScenarioTags } = require("../shared/catalog-taxonomy.cjs");

const SUBMISSION_KINDS = Object.freeze([
  "vendor",
  "agent",
  "skill",
  "mcp",
  "plugin",
  "connector",
  "workflow"
]);
const STATUSES = Object.freeze([
  "draft",
  "submitted",
  "triaged",
  "needs-evidence",
  "accepted",
  "rejected",
  "withdrawn",
  "merged"
]);
const OWNER_ACTIONS = new Set(["update", "submit", "withdraw", "evidence"]);
const REVIEWER_ACTIONS = new Set([
  "triage",
  "needs-evidence",
  "accept",
  "reject",
  "merge",
  "set-public-eligibility"
]);
const REVIEW_STATUSES = new Set([
  "unreviewed",
  "automated-reviewed",
  "manually-reviewed",
  "rejected"
]);
const RISK_LEVELS = new Set(["low", "guarded", "unsafe"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const RESOURCE_BINDING_KINDS = new Set([
  "skill-context",
  "mcp-tool",
  "mcp-resource",
  "mcp-prompt",
  "plugin-host-extension",
  "connector-authorized-connection"
]);
const FORBIDDEN = new Set([
  "command",
  "args",
  "env",
  "headers",
  "credentials",
  "script",
  "endpoint",
  "path",
  "url",
  "secret",
  "vaultRef"
]);

class ResourceSubmissionError extends Error {
  constructor(message, status = 400, code = "INVALID_RESOURCE_SUBMISSION") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(message, status, code) {
  throw new ResourceSubmissionError(message, status, code);
}

function exact(value, fields, required = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.every((key) => fields.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function text(value, max, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > max) fail(`${label} invalid`);
  return normalized;
}

function https(value, label) {
  const raw = text(value, 2048, label);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${label} invalid`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.toString() !== raw
  ) {
    fail(`${label} invalid`);
  }
  return raw;
}

function expectedRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail("revision conflict", 409, "REVISION_CONFLICT");
  }
  return value;
}

function snapshot(value) {
  return Object.freeze(structuredClone(value));
}

function sourceSnapshot(record, actor, at) {
  const proposal = record.proposal;
  return snapshot({
    revision: record.revision,
    at,
    actorIdentityId: text(actor.identityId, 160, "identity"),
    canonicalSource: proposal.canonicalSource,
    originalAuthorIdentityId: proposal.originalAuthorIdentityId,
    originalAuthor: proposal.originalAuthor,
    organization: proposal.organization,
    licenseId: proposal.licenseId,
    evidenceRefs: proposal.evidenceRefs,
    discoveredVia: proposal.discoveredVia,
    workflowRef: proposal.workflowRef,
    catalogReferences: proposal.catalogReferences,
    hostTuples: proposal.hostTuples
  });
}

function latestSourceSnapshot(record) {
  const snapshots = Array.isArray(record?.sourceSnapshots) ? record.sourceSnapshots : [];
  const source = snapshots.at(-1);
  return source && Number.isSafeInteger(source.revision) ? source : null;
}

function hidePublicEligibility(record) {
  record.publicEligibility = false;
  record.publicEligibilitySourceRevision = null;
}

function references(value) {
  if (!Array.isArray(value) || value.length > 21) {
    fail("catalog references invalid");
  }
  return value.map((item) => {
    if (
      !exact(
        item,
        new Set(["kind", "canonicalId", "hostProductId"]),
        ["kind", "canonicalId"]
      ) ||
      !["product", "resource"].includes(item.kind)
    ) {
      fail("catalog reference invalid");
    }
    return {
      kind: item.kind,
      canonicalId: text(item.canonicalId, 160, "catalog reference"),
      hostProductId: item.hostProductId
        ? text(item.hostProductId, 160, "host product")
        : null
    };
  });
}

function hostTuples(value) {
  if (!Array.isArray(value) || value.length > 21) fail("hostTuples invalid");
  return value.map((item) => {
    if (
      !exact(
        item,
        new Set(["kind", "canonicalId", "hostProductId", "bindingKind"]),
        ["kind", "canonicalId", "hostProductId", "bindingKind"]
      ) ||
      item.kind !== "resource" ||
      !CANONICAL_ID_PATTERN.test(String(item.canonicalId || "")) ||
      !CANONICAL_ID_PATTERN.test(String(item.hostProductId || "")) ||
      !RESOURCE_BINDING_KINDS.has(item.bindingKind)
    ) {
      fail("host tuple invalid");
    }
    return {
      kind: "resource",
      canonicalId: item.canonicalId,
      hostProductId: item.hostProductId,
      bindingKind: item.bindingKind
    };
  });
}

function claim(value) {
  if (value == null) return null;
  if (
    !exact(value, new Set(["kind", "evidenceRefs"]), ["kind", "evidenceRefs"]) ||
    !["author", "organization"].includes(value.kind) ||
    !Array.isArray(value.evidenceRefs) ||
    !value.evidenceRefs.length ||
    value.evidenceRefs.length > 8
  ) {
    fail("ownership claim invalid");
  }
  return {
    kind: value.kind,
    evidenceRefs: [
      ...new Set(
        value.evidenceRefs.map((item) => https(item, "ownership evidence"))
      )
    ]
  };
}

function submissionFingerprint(proposal) {
  return JSON.stringify({
    canonicalSource: proposal.canonicalSource,
    originalAuthorIdentityId: proposal.originalAuthorIdentityId,
    catalogReferences: proposal.catalogReferences,
    hostTuples: proposal.hostTuples,
    workflowRef: proposal.workflowRef
  });
}

function hasPublishedWorkflowRelease(proposal, resolver) {
  return (
    proposal.submissionKind !== "workflow" ||
    (typeof resolver === "function" && resolver(proposal.workflowRef) === true)
  );
}

function normalizeResourceSubmission(input, { hasWorkflowRelease } = {}) {
  const fields = new Set([
    "submissionKind",
    "title",
    "summary",
    "originalAuthorIdentityId",
    "originalAuthor",
    "organization",
    "ownershipClaim",
    "canonicalSource",
    "licenseId",
    "sourceRevision",
    "catalogReferences",
    "hostTuples",
    "platforms",
    "scenarioTags",
    "rawTags",
    "agentCompatibility",
    "evidenceRefs",
    "discoveredVia",
    "workflowRef"
  ]);
  if (
    !exact(input, fields, ["submissionKind", "title", "summary", "canonicalSource"]) ||
    Object.keys(input).some((key) => FORBIDDEN.has(key))
  ) {
    fail("submission fields invalid");
  }
  if (!SUBMISSION_KINDS.includes(input.submissionKind)) {
    fail("submission kind invalid");
  }
  const proposal = {
    submissionKind: input.submissionKind,
    title: text(input.title, 160, "title"),
    summary: text(input.summary, 1000, "summary"),
    originalAuthorIdentityId: input.originalAuthorIdentityId
      ? text(input.originalAuthorIdentityId, 120, "original author identity")
      : null,
    originalAuthor: input.originalAuthor
      ? text(input.originalAuthor, 160, "original author")
      : null,
    organization: input.organization
      ? text(input.organization, 160, "organization")
      : null,
    ownershipClaim: claim(input.ownershipClaim),
    canonicalSource: https(input.canonicalSource, "canonical source"),
    licenseId: input.licenseId ? text(input.licenseId, 100, "license") : null,
    sourceRevision: input.sourceRevision
      ? text(input.sourceRevision, 128, "source revision")
      : null,
    catalogReferences: references(input.catalogReferences || []),
    hostTuples: hostTuples(input.hostTuples || []),
    platforms: Array.isArray(input.platforms)
      ? input.platforms.map((item) => text(item, 80, "platform"))
      : [],
    scenarioTags: canonicalScenarioTags(input.scenarioTags),
    rawTags: Array.isArray(input.rawTags)
      ? input.rawTags.map((item) => text(item, 80, "raw tag"))
      : [],
    agentCompatibility: Array.isArray(input.agentCompatibility)
      ? input.agentCompatibility.map((item) =>
          text(item, 80, "agent compatibility")
        )
      : [],
    evidenceRefs: Array.isArray(input.evidenceRefs)
      ? input.evidenceRefs.map((item) => https(item, "evidence"))
      : [],
    discoveredVia: input.discoveredVia
      ? text(input.discoveredVia, 160, "discovered via")
      : null,
    workflowRef: input.workflowRef || null
  };
  if (
    proposal.originalAuthorIdentityId &&
    !UUID_PATTERN.test(proposal.originalAuthorIdentityId)
  ) {
    fail("original author identity invalid");
  }
  for (const field of [
    "hostTuples",
    "platforms",
    "scenarioTags",
    "rawTags",
    "agentCompatibility",
    "evidenceRefs"
  ]) {
    const comparable = proposal[field].map((item) =>
      typeof item === "string" ? item : JSON.stringify(item)
    );
    if (new Set(comparable).size !== comparable.length || proposal[field].length > 21) {
      fail(`${field} invalid`);
    }
  }
  if (
    new Set(proposal.catalogReferences.map(JSON.stringify)).size !==
    proposal.catalogReferences.length
  ) {
    fail("catalog references invalid");
  }
  if (proposal.submissionKind === "workflow") {
    if (
      !exact(
        proposal.workflowRef,
        new Set(["workflowId", "version"]),
        ["workflowId", "version"]
      ) ||
      !hasPublishedWorkflowRelease(proposal, hasWorkflowRelease)
    ) {
      fail("workflow reference invalid");
    }
  } else if (proposal.workflowRef !== null) {
    fail("workflow reference invalid");
  }
  return snapshot(proposal);
}

function createAsyncWorkflowReleaseValidator({
  lookupPublishedRelease,
  timeoutMs = 2000
} = {}) {
  if (typeof lookupPublishedRelease !== "function") {
    throw new TypeError("published workflow release lookup required");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new TypeError("workflow release lookup timeout invalid");
  }
  return async function validateResourceSubmission(input) {
    if (input?.submissionKind !== "workflow") {
      return normalizeResourceSubmission(input);
    }
    const proposal = normalizeResourceSubmission(input, {
      hasWorkflowRelease: () => true
    });
    let timeout;
    let available = false;
    try {
      available = await Promise.race([
        Promise.resolve().then(() => lookupPublishedRelease(proposal.workflowRef)),
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve(false), timeoutMs);
        })
      ]);
    } catch {
      available = false;
    } finally {
      clearTimeout(timeout);
    }
    if (available !== true) fail("workflow reference invalid");
    return proposal;
  };
}

function auditEvent(record, actor, action, at, detail = null) {
  return Object.freeze({
    revision: record.revision,
    at,
    actorIdentityId: text(actor.identityId, 160, "identity"),
    actorKind: actor.kind,
    action,
    detail
  });
}

function createResourceSubmissionRecord({
  actor,
  proposal,
  submissionId,
  possibleDuplicateSubmissionIds = [],
  at
}) {
  const ownerId = text(actor?.identityId, 120, "identity");
  const record = {
    submissionId: text(submissionId, 120, "submission id"),
    revision: 1,
    status: "draft",
    submittedByIdentityId: ownerId,
    submittedByDisplayName: text(actor?.displayName, 160, "display name"),
    reviewedBy: null,
    reviewStatus: "unreviewed",
    riskLevel: null,
    proposal: snapshot(proposal),
    dedupeFingerprint: submissionFingerprint(proposal),
    possibleDuplicateSubmissionIds: [...possibleDuplicateSubmissionIds],
    contributors: [ownerId],
    mergeIntoSubmissionId: null,
    publicEligibility: false,
    publicEligibilitySourceRevision: null,
    sourceSnapshots: [],
    audit: []
  };
  record.audit.push(
    auditEvent(record, { identityId: ownerId, kind: "owner" }, "created", at)
  );
  record.sourceSnapshots.push(
    sourceSnapshot(record, { identityId: ownerId }, at)
  );
  return snapshot(record);
}

function applyResourceSubmissionAction(
  current,
  { actor, expectedRevision: expected, action, submission, evidenceRefs, mergeTarget, reviewStatus, riskLevel, publicEligibility },
  { hasWorkflowRelease, at } = {}
) {
  expectedRevision(expected);
  if (current.revision !== expected) {
    fail("revision conflict", 409, "REVISION_CONFLICT");
  }
  const actorId = text(actor?.identityId, 160, "identity");
  if (!actor || !["owner", "reviewer"].includes(actor.kind)) {
    fail("submission actor invalid", 403, "ACCESS_DENIED");
  }
  if (actor.kind === "owner") {
    if (current.submittedByIdentityId !== actorId || !OWNER_ACTIONS.has(action)) {
      fail("submission access denied", 404, "NOT_FOUND");
    }
  } else {
    if (!REVIEWER_ACTIONS.has(action)) {
      fail("reviewer access denied", 403, "REVIEWER_ACCESS_DENIED");
    }
    if (current.submittedByIdentityId === actorId) {
      fail("self review forbidden", 403, "SELF_REVIEW_FORBIDDEN");
    }
  }

  const next = structuredClone(current);
  let changedTarget = null;
  let sourceChanged = false;
  if (action === "update" && current.status === "draft") {
    next.proposal = normalizeResourceSubmission(submission, { hasWorkflowRelease });
    next.dedupeFingerprint = submissionFingerprint(next.proposal);
    sourceChanged = true;
  } else if (action === "submit" && current.status === "draft") {
    next.status = "submitted";
  } else if (
    action === "withdraw" &&
    ["draft", "submitted", "triaged", "needs-evidence"].includes(current.status)
  ) {
    next.status = "withdrawn";
  } else if (
    action === "evidence" &&
    ["submitted", "triaged", "needs-evidence"].includes(current.status)
  ) {
    if (!Array.isArray(evidenceRefs) || !evidenceRefs.length) {
      fail("evidence invalid");
    }
    next.proposal.evidenceRefs = [
      ...new Set([
        ...next.proposal.evidenceRefs,
        ...evidenceRefs.map((item) => https(item, "evidence"))
      ])
    ];
    if (next.proposal.evidenceRefs.length > 21) fail("evidenceRefs invalid");
    sourceChanged = true;
  } else if (action === "triage" && current.status === "submitted") {
    next.status = "triaged";
  } else if (
    action === "needs-evidence" &&
    ["submitted", "triaged"].includes(current.status)
  ) {
    next.status = "needs-evidence";
  } else if (
    action === "accept" &&
    ["submitted", "triaged", "needs-evidence"].includes(current.status) &&
    hasPublishedWorkflowRelease(next.proposal, hasWorkflowRelease) &&
    REVIEW_STATUSES.has(reviewStatus) &&
    !["unreviewed", "rejected"].includes(reviewStatus) &&
    RISK_LEVELS.has(riskLevel) &&
    riskLevel !== "unsafe"
  ) {
    next.status = "accepted";
    next.reviewStatus = reviewStatus;
    next.riskLevel = riskLevel;
    next.reviewedBy = actorId;
  } else if (
    action === "reject" &&
    current.status !== "merged" &&
    RISK_LEVELS.has(riskLevel)
  ) {
    next.status = "rejected";
    next.reviewStatus = "rejected";
    next.riskLevel = riskLevel;
    next.reviewedBy = actorId;
  } else if (action === "merge" && current.status !== "merged") {
    if (
      !mergeTarget ||
      mergeTarget.submissionId === current.submissionId ||
      mergeTarget.dedupeFingerprint !== current.dedupeFingerprint ||
      mergeTarget.status === "merged"
    ) {
      fail("submission merge mismatch", 409, "MERGE_MISMATCH");
    }
    next.status = "merged";
    next.mergeIntoSubmissionId = mergeTarget.submissionId;
    changedTarget = structuredClone(mergeTarget);
    changedTarget.revision += 1;
    changedTarget.contributors = [
      ...new Set([...changedTarget.contributors, ...next.contributors])
    ];
    changedTarget.audit.push(
      auditEvent(
        changedTarget,
        actor,
        "merged-contributor",
        at,
        { submissionId: current.submissionId }
      )
    );
    hidePublicEligibility(changedTarget);
  } else if (action === "set-public-eligibility") {
    if (typeof publicEligibility !== "boolean") fail("public eligibility invalid");
    if (publicEligibility) {
      const source = latestSourceSnapshot(next);
      if (
        next.status !== "accepted" ||
        !["automated-reviewed", "manually-reviewed"].includes(next.reviewStatus) ||
        !["low", "guarded"].includes(next.riskLevel) ||
        !source?.canonicalSource ||
        !source.licenseId ||
        !hasPublishedWorkflowRelease(next.proposal, hasWorkflowRelease)
      ) {
        fail("public eligibility unavailable", 409, "PUBLIC_ELIGIBILITY_UNAVAILABLE");
      }
      next.publicEligibility = true;
      next.publicEligibilitySourceRevision = source.revision;
    } else {
      hidePublicEligibility(next);
    }
  } else {
    fail("submission transition invalid", 409, "INVALID_TRANSITION");
  }

  next.revision += 1;
  next.audit.push(auditEvent(next, actor, action, at));
  if (sourceChanged) next.sourceSnapshots.push(sourceSnapshot(next, actor, at));
  if (action !== "set-public-eligibility") hidePublicEligibility(next);
  return Object.freeze({ record: snapshot(next), mergeTarget: changedTarget && snapshot(changedTarget) });
}

function resourceSubmissionCatalogMergeCandidate(record) {
  if (
    !record ||
    record.status !== "accepted" ||
    record.reviewStatus === "rejected" ||
    record.riskLevel === "unsafe"
  ) {
    fail(
      "catalog merge candidate unavailable",
      409,
      "CATALOG_MERGE_CANDIDATE_UNAVAILABLE"
    );
  }
  const source = latestSourceSnapshot(record);
  if (!source) fail("catalog merge candidate unavailable", 409, "CATALOG_MERGE_CANDIDATE_UNAVAILABLE");
  return snapshot({
    candidateOnly: true,
    submissionId: record.submissionId,
    revision: record.revision,
    proposal: record.proposal,
    reviewStatus: record.reviewStatus,
    riskLevel: record.riskLevel,
    contributors: record.contributors,
    sourceRevisionRef: { submissionId: record.submissionId, revision: source.revision }
  });
}

function createResourceSubmissionStore({
  now = () => new Date().toISOString(),
  hasWorkflowRelease = () => false,
  rateLimit = () => true,
  enabled = false,
  makeId = crypto.randomUUID
} = {}) {
  const records = new Map();
  const idempotency = new Map();
  const capability = Object.freeze({
    enabled: Boolean(enabled),
    supportedKinds: SUBMISSION_KINDS,
    authenticationRequired: true,
    proposalSchemaVersion: 1
  });

  function mine(id, actorId) {
    const record = records.get(id);
    if (!record || record.submittedByIdentityId !== actorId) {
      fail("submission not found", 404, "NOT_FOUND");
    }
    return record;
  }

  function create({ actor, idempotencyKey, submission }) {
    const actorId = text(actor?.identityId, 120, "identity");
    if (!rateLimit(actorId, "create")) {
      fail("submission rate limited", 429, "RATE_LIMITED");
    }
    const proposal = normalizeResourceSubmission(submission, { hasWorkflowRelease });
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(proposal))
      .digest("hex");
    const key = `${actorId}\0${text(idempotencyKey, 160, "idempotency key")}`;
    const prior = idempotency.get(key);
    if (prior) {
      if (prior.requestHash !== requestHash) {
        fail("idempotency conflict", 409, "IDEMPOTENCY_CONFLICT");
      }
      return snapshot(records.get(prior.submissionId));
    }
    const dedupeFingerprint = submissionFingerprint(proposal);
    const duplicates = [...records.values()]
      .filter(
        (record) =>
          record.dedupeFingerprint === dedupeFingerprint &&
          record.status !== "merged"
      )
      .map((record) => record.submissionId);
    const record = createResourceSubmissionRecord({
      actor,
      proposal,
      submissionId: makeId(),
      possibleDuplicateSubmissionIds: duplicates,
      at: now()
    });
    records.set(record.submissionId, record);
    idempotency.set(key, { submissionId: record.submissionId, requestHash });
    return record;
  }

  function mutateOwner(input) {
    const current = mine(input.submissionId, input.actorId);
    const result = applyResourceSubmissionAction(
      current,
      {
        ...input,
        actor: { identityId: input.actorId, kind: "owner" }
      },
      { hasWorkflowRelease, at: now() }
    );
    records.set(result.record.submissionId, result.record);
    return result.record;
  }

  function review(input) {
    const current = records.get(input.submissionId);
    if (!current) fail("submission not found", 404, "NOT_FOUND");
    const mergeTarget = input.mergeIntoSubmissionId
      ? records.get(input.mergeIntoSubmissionId)
      : null;
    const result = applyResourceSubmissionAction(
      current,
      {
        ...input,
        actor: { identityId: input.reviewerIdentityId, kind: "reviewer" },
        mergeTarget
      },
      { hasWorkflowRelease, at: now() }
    );
    records.set(result.record.submissionId, result.record);
    if (result.mergeTarget) {
      records.set(result.mergeTarget.submissionId, result.mergeTarget);
    }
    return result.record;
  }

  function findDuplicates({ reviewerIdentityId, submissionId }) {
    text(reviewerIdentityId, 160, "reviewer identity");
    const record = records.get(submissionId);
    if (!record) fail("submission not found", 404, "NOT_FOUND");
    return [...records.values()]
      .filter(
        (item) =>
          item.submissionId !== submissionId &&
          item.dedupeFingerprint === record.dedupeFingerprint &&
          item.status !== "merged"
      )
      .map(snapshot);
  }

  return Object.freeze({
    capability: () => capability,
    create,
    mutateOwner,
    review,
    get: (id, actorId) => snapshot(mine(id, actorId)),
    catalogMergeCandidate: (id) =>
      resourceSubmissionCatalogMergeCandidate(records.get(id)),
    findDuplicates,
    list: (actorId, { offset = 0, limit = 20 } = {}) =>
      [...records.values()]
        .filter((record) => record.submittedByIdentityId === actorId)
        .slice(offset, offset + limit)
        .map(snapshot)
  });
}

function createResourceSubmissionHttpSeam({ store, resolveIdentity = () => null } = {}) {
  if (!store || typeof store.capability !== "function") {
    throw new TypeError("submission store required");
  }
  function requireEnabled() {
    if (!store.capability().enabled) {
      fail("resource submission is unavailable", 503, "FEATURE_DISABLED");
    }
  }
  return Object.freeze({
    capability() {
      return store.capability();
    },
    async create(request) {
      requireEnabled();
      const actor = await resolveIdentity(request);
      if (!actor) fail("authentication required", 401, "AUTHENTICATION_REQUIRED");
      return store.create({
        actor,
        idempotencyKey: request?.headers?.["idempotency-key"],
        submission: request?.body
      });
    }
  });
}

function createResourceSubmissionAdminReviewSeam({ reviewAdapter, enabled = false } = {}) {
  if (!reviewAdapter || typeof reviewAdapter.review !== "function") {
    throw new TypeError("review adapter required");
  }
  return Object.freeze({
    capability: () => Object.freeze({ enabled: Boolean(enabled), serviceOnly: true }),
    async review(request) {
      if (!enabled) fail("resource submission review is unavailable", 503, "FEATURE_DISABLED");
      return reviewAdapter.review(request);
    }
  });
}

module.exports = {
  OWNER_ACTIONS,
  REVIEWER_ACTIONS,
  SUBMISSION_KINDS,
  STATUSES,
  ResourceSubmissionError,
  applyResourceSubmissionAction,
  createAsyncWorkflowReleaseValidator,
  createResourceSubmissionAdminReviewSeam,
  createResourceSubmissionHttpSeam,
  createResourceSubmissionRecord,
  createResourceSubmissionStore,
  normalizeResourceSubmission,
  resourceSubmissionCatalogMergeCandidate,
  submissionFingerprint
};
