"use strict";

const crypto = require("node:crypto");
const {
  WorkflowCandidateError,
  createCommunityWorkflowCandidate,
  createCommunityWorkflowHttpHandler,
  createPostgresWorkflowRepository
} = require("../community/workflow-persistence.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 128 * 1024;
const DEFAULT_IDENTITY_WORKFLOW_RESOLVER_TIMEOUT_MS = 2_000;
const FORBIDDEN_FIELDS = new Set([
  "__proto__", "prototype", "constructor", "command", "args", "env",
  "headers", "credentials", "script", "secret", "endpoint", "path",
  "url", "reviewerId", "reviewedBy", "internalNotes", "audit"
]);

function fixedError(code, status, messageKey) {
  return Object.freeze({ status, body: { error: { code, status, messageKey } } });
}

function safeError(error) {
  const code = typeof error?.code === "string" ? error.code : "TEMPORARILY_UNAVAILABLE";
  const status = Number(error?.status);
  if (code === "AUTHENTICATION_REQUIRED" || status === 401) {
    return fixedError("AUTHENTICATION_REQUIRED", 401, "workflow.store.loginRequired");
  }
  if (code === "REVIEW_SERVICE_AUTHENTICATION_FAILED" || status === 403) {
    return fixedError("ACCESS_DENIED", 403, "workflow.store.accessDenied");
  }
  if (code === "NOT_FOUND" || status === 404) {
    return fixedError("NOT_FOUND", 404, "workflow.store.notFound");
  }
  if (["REVISION_CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(code) || status === 409) {
    return fixedError(code === "IDEMPOTENCY_CONFLICT" ? code : "REVISION_CONFLICT", 409, "workflow.store.conflict");
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return fixedError("RATE_LIMITED", 429, "workflow.store.rateLimited");
  }
  if (code === "FEATURE_DISABLED") {
    return fixedError("FEATURE_DISABLED", 503, "workflow.store.unavailable");
  }
  if (code === "INVALID_IDENTITY_RESPONSE") {
    return fixedError("INVALID_IDENTITY_RESPONSE", 502, "workflow.store.failed");
  }
  if (status >= 400 && status < 500) {
    return fixedError("INVALID_INPUT", 400, "workflow.store.invalid");
  }
  return fixedError("TEMPORARILY_UNAVAILABLE", 503, "workflow.store.serviceUnavailable");
}

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafeTree(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new WorkflowCandidateError("INVALID_INPUT", "request is invalid", 400);
  seen.add(value);
  if (!Array.isArray(value) && !plainRecord(value)) {
    throw new WorkflowCandidateError("INVALID_INPUT", "request is invalid", 400);
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      throw new WorkflowCandidateError("INVALID_INPUT", "request is invalid", 400);
    }
    assertSafeTree(value[key], seen);
  }
  seen.delete(value);
}

function assertRequestSize(body) {
  if (body === undefined) return;
  assertSafeTree(body);
  let encoded;
  try {
    encoded = JSON.stringify(body);
  } catch {
    throw new WorkflowCandidateError("INVALID_INPUT", "request is invalid", 400);
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_REQUEST_BYTES) {
    throw new WorkflowCandidateError("INVALID_INPUT", "request is too large", 400);
  }
}

function ownerWorkflowDto(value) {
  if (!plainRecord(value)) {
    throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow owner response is invalid", 502);
  }
  const required = [
    "workflowId", "expectedRevision", "status", "sourceCommunityPostId",
    "provenance", "content", "latestReleaseVersion", "rejectionReason",
    "postReferences", "allowedActions"
  ];
  if (required.some((key) => !Object.hasOwn(value, key))) {
    throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow owner response is invalid", 502);
  }
  const result = Object.fromEntries(required.map((key) => [key, value[key]]));
  assertSafeTree(result);
  return Object.freeze(result);
}

function ownerHttpBody(method, path, body) {
  if (method === "GET" && path === "/v1/community/workflow-store/owner/drafts") {
    return Object.freeze({ ...body, items: body.items.map(ownerWorkflowDto) });
  }
  if (path === "/v1/community/workflow-store/owner/posts/attach" || path === "/v1/community/workflow-store/owner/posts/detach") {
    return Object.freeze({ draft: ownerWorkflowDto(body.draft), postReference: body.postReference });
  }
  if (path === "/v1/community/workflow-store/owner/reports") return body;
  if (path.startsWith("/v1/community/workflow-store/owner/")) return ownerWorkflowDto(body);
  return body;
}

function exactPublicRecord(value, fields) {
  if (!plainRecord(value) || Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) {
    throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow public response is invalid", 502);
  }
  return value;
}

function publicDisplayName(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 ||
      /[\p{Cc}\p{Cf}]/u.test(normalized) || /[<>]/.test(normalized) ||
      /&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);/i.test(normalized) ||
      /\b(?:https?:\/\/|www\.)/i.test(normalized) ||
      /\b(?:password|passwd|secret|token|credential|api[-_ ]?key|bearer)\b/i.test(normalized)) {
    return null;
  }
  return normalized;
}

async function optionalOriginalAuthorDisplayName(resolvePublicIdentity, identityId) {
  try {
    const profile = await resolvePublicIdentity(identityId);
    if (!plainRecord(profile) ||
        Object.keys(profile).some((key) => !["identityId", "displayName"].includes(key)) ||
        !Object.hasOwn(profile, "identityId") || !Object.hasOwn(profile, "displayName") ||
        profile.identityId !== identityId) {
      return null;
    }
    return publicDisplayName(profile.displayName);
  } catch {
    return null;
  }
}

async function publicWorkflowDto(input, resolvePublicIdentity) {
  const value = exactPublicRecord(input, [
    "workflowId", "version", "author", "sourceCommunityPostId", "provenance",
    "content", "reviewStatus", "riskLevel", "requiresPerUseConfirmation", "releasedAt"
  ]);
  const author = exactPublicRecord(value.author, ["identityId", "displayName"]);
  const provenance = exactPublicRecord(value.provenance, ["originalAuthorIdentityId", "canonicalSource", "licenseId", "derivedFrom"]);
  const canonicalSource = exactPublicRecord(provenance.canonicalSource, ["kind", "canonicalId"]);
  const content = exactPublicRecord(value.content, ["title", "summary", "inputs", "outputs", "instructions", "dependencies", "secretPlaceholders"]);
  const authorDisplayName = publicDisplayName(author.displayName);
  if (!UUID_PATTERN.test(value.workflowId) || !Number.isSafeInteger(value.version) || value.version < 1 ||
      !UUID_PATTERN.test(author.identityId) || !UUID_PATTERN.test(provenance.originalAuthorIdentityId) ||
      authorDisplayName === null || typeof value.sourceCommunityPostId !== "string" ||
      typeof provenance.licenseId !== "string" || typeof content.title !== "string" || typeof content.summary !== "string" ||
      typeof value.releasedAt !== "string" ||
      !["automated-reviewed", "manually-reviewed"].includes(value.reviewStatus) ||
      !["low", "guarded"].includes(value.riskLevel) || typeof value.requiresPerUseConfirmation !== "boolean" ||
      canonicalSource.kind !== "community-post" || typeof canonicalSource.canonicalId !== "string" ||
      !Array.isArray(provenance.derivedFrom) || !Array.isArray(content.inputs) || !Array.isArray(content.outputs) ||
      !Array.isArray(content.instructions) || !Array.isArray(content.dependencies) || !Array.isArray(content.secretPlaceholders)) {
    throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow public response is invalid", 502);
  }
  const derivedFrom = provenance.derivedFrom.map((entry) => exactPublicRecord(entry, ["workflowId", "version"]));
  const inputs = content.inputs.map((entry) => exactPublicRecord(entry, ["name", "type", "required", "description"]));
  const outputs = content.outputs.map((entry) => exactPublicRecord(entry, ["name", "type", "description"]));
  const dependencies = content.dependencies.map((entry) => exactPublicRecord(entry, entry?.kind === "product"
    ? ["kind", "canonicalId", "permissions"]
    : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]));
  content.secretPlaceholders.forEach((entry) => exactPublicRecord(entry, ["name", "description"]));
  if (derivedFrom.some((entry) => !UUID_PATTERN.test(entry.workflowId) || !Number.isSafeInteger(entry.version) || entry.version < 1) ||
      inputs.some((entry) => typeof entry.name !== "string" || typeof entry.type !== "string" || typeof entry.required !== "boolean" || typeof entry.description !== "string") ||
      outputs.some((entry) => typeof entry.name !== "string" || typeof entry.type !== "string" || typeof entry.description !== "string") ||
      content.instructions.some((entry) => typeof entry !== "string") ||
      dependencies.some((entry) => !["product", "resource"].includes(entry.kind) || typeof entry.canonicalId !== "string" || !Array.isArray(entry.permissions) || entry.permissions.some((permission) => typeof permission !== "string") ||
        (entry.kind === "resource" && (typeof entry.hostProductId !== "string" || typeof entry.bindingKind !== "string")))) {
    throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow public response is invalid", 502);
  }
  const result = {
    workflowId: value.workflowId,
    version: value.version,
    author: { displayName: authorDisplayName },
    sourceCommunityPostId: value.sourceCommunityPostId,
    provenance: {
      canonicalSource: { kind: canonicalSource.kind, canonicalId: canonicalSource.canonicalId },
      licenseId: provenance.licenseId,
      derivedFrom
    },
    content: {
      title: content.title,
      summary: content.summary,
      inputs,
      outputs,
      instructions: content.instructions,
      dependencies
    },
    reviewStatus: value.reviewStatus,
    riskLevel: value.riskLevel,
    requiresPerUseConfirmation: value.requiresPerUseConfirmation,
    releasedAt: value.releasedAt
  };
  const originalAuthorDisplayName = await optionalOriginalAuthorDisplayName(
    resolvePublicIdentity,
    provenance.originalAuthorIdentityId
  );
  if (originalAuthorDisplayName !== null) result.originalAuthorDisplayName = originalAuthorDisplayName;
  assertSafeTree(result);
  return Object.freeze(result);
}

function publicQuery(request) {
  const path = request?.path || "";
  const query = request?.query || {};
  assertRequestSize(query);
  const fields = path.endsWith("/list") ? ["limit", "after", "riskLevel"] : ["workflowId", "version"];
  if (!plainRecord(query) || Object.keys(query).some((key) => !fields.includes(key))) {
    throw new WorkflowCandidateError("INVALID_INPUT", "workflow public query is invalid", 400);
  }
  if (path.endsWith("/list")) {
    if (query.limit !== undefined && (!Number.isSafeInteger(Number(query.limit)) || Number(query.limit) < 1 || Number(query.limit) > 50)) {
      throw new WorkflowCandidateError("INVALID_INPUT", "workflow public query is invalid", 400);
    }
    if (query.after !== undefined && !UUID_PATTERN.test(String(query.after))) {
      throw new WorkflowCandidateError("INVALID_INPUT", "workflow public query is invalid", 400);
    }
    if (query.riskLevel !== undefined && !["low", "guarded"].includes(query.riskLevel)) {
      throw new WorkflowCandidateError("INVALID_INPUT", "workflow public query is invalid", 400);
    }
    return {
      communityQuery: Object.fromEntries(Object.entries(query).filter(([key]) => key !== "riskLevel")),
      riskLevel: query.riskLevel
    };
  }
  if (!UUID_PATTERN.test(String(query.workflowId || "")) || !Number.isSafeInteger(Number(query.version)) || Number(query.version) < 1) {
    throw new WorkflowCandidateError("INVALID_INPUT", "workflow public reference is invalid", 400);
  }
  return { communityQuery: { workflowId: String(query.workflowId).toLowerCase(), version: Number(query.version) } };
}

function createFixedWorkflowReviewerAuthenticator({ secret, reviewerIdentityId } = {}) {
  const expected = Buffer.from(String(secret || ""));
  const identityId = String(reviewerIdentityId || "").trim().toLowerCase();
  if (expected.length < 32 || !UUID_PATTERN.test(identityId)) {
    throw new TypeError("workflow reviewer service authentication configuration is invalid");
  }
  return async function authenticateReviewer(request) {
    const received = Buffer.from(String(request?.headers?.["x-aihub-workflow-review-secret"] || ""));
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      throw new WorkflowCandidateError(
        "REVIEW_SERVICE_AUTHENTICATION_FAILED",
        "workflow review service authentication failed",
        403
      );
    }
    return identityId;
  };
}

function createIdentityWorkflowStoreGateway({
  pool,
  repository,
  workflowStoreEnabled = false,
  workflowPublicStoreEnabled = false,
  resourceSubmissionsEnabled = false,
  workflowSubmissionLookupEnabled = false,
  resolveOwnerIdentity,
  authenticateReviewer,
  resolvePublicIdentity,
  hasCanonicalDependency,
  hasCanonicalLicense,
  hasCommunityPost,
  isCanonicalDependencyReady = () => true,
  prepareCanonicalDependencies = async () => true,
  resolverTimeoutMs = DEFAULT_IDENTITY_WORKFLOW_RESOLVER_TIMEOUT_MS,
  makeId,
  now,
  logError = () => {}
} = {}) {
  const repositoryReady = Boolean(repository || pool);
  const dependenciesReady = Boolean(
    typeof resolveOwnerIdentity === "function" &&
    typeof authenticateReviewer === "function" &&
    typeof resolvePublicIdentity === "function" &&
    typeof hasCanonicalDependency === "function" &&
    typeof hasCanonicalLicense === "function" &&
    typeof hasCommunityPost === "function" &&
    typeof isCanonicalDependencyReady === "function" &&
    typeof prepareCanonicalDependencies === "function" &&
    repositoryReady
  );
  const enabled = workflowStoreEnabled === true && dependenciesReady;
  const publicEnabled = workflowPublicStoreEnabled === true && repositoryReady && typeof resolvePublicIdentity === "function";
  const candidateEnabled = enabled || publicEnabled;
  const resolvedRepository = repository || createPostgresWorkflowRepository({ pool, enabled: candidateEnabled });
  const candidate = createCommunityWorkflowCandidate({
    enabled: candidateEnabled,
    repository: resolvedRepository,
    resolveOwnerIdentity: resolveOwnerIdentity || (async () => null),
    resolveReviewerIdentity: authenticateReviewer || (async () => null),
    resolvePublicIdentity: resolvePublicIdentity || (async () => null),
    hasCanonicalDependency: hasCanonicalDependency || (async () => false),
    hasCanonicalLicense: hasCanonicalLicense || (async () => false),
    hasCommunityPost: hasCommunityPost || (async () => false),
    resolverTimeoutMs,
    ...(makeId ? { makeId } : {}),
    ...(now ? { now } : {})
  });
  const http = createCommunityWorkflowHttpHandler({ candidate });
  const submissionLookupEnabled = Boolean(
    enabled &&
    resourceSubmissionsEnabled === true &&
    workflowSubmissionLookupEnabled === true
  );

  function catalogReady() {
    try {
      return isCanonicalDependencyReady() === true;
    } catch {
      return false;
    }
  }

  function prepareCatalog() {
    void Promise.resolve()
      .then(() => prepareCanonicalDependencies())
      .catch((error) => logError("Identity workflow catalog warmup failed", error));
  }

  function ownerEnabled() {
    if (!enabled) return false;
    if (catalogReady()) return true;
    prepareCatalog();
    return false;
  }

  function capability() {
    const operational = ownerEnabled();
    return Object.freeze({
      ...candidate.capability(),
      enabled: operational,
      workflowSubmissionLookup: submissionLookupEnabled && operational
    });
  }

  function publicCapability() {
    return Object.freeze({ enabled: publicEnabled, schemaVersion: 1, execution: false });
  }

  async function handle(request) {
    try {
      assertRequestSize(request?.body);
      const method = String(request?.method || "").toUpperCase();
      const path = request?.path || "";
      if (
        method === "GET" &&
        path === "/v1/community/workflow-store/capability"
      ) {
        return Object.freeze({ status: 200, body: capability() });
      }
      if (method === "GET" && path === "/v1/community/workflow-store/public/capability") {
        return Object.freeze({ status: 200, body: publicCapability() });
      }
      if (path.startsWith("/v1/community/workflow-store/public/")) {
        if (!publicEnabled) return fixedError("FEATURE_DISABLED", 503, "workflow.public.unavailable");
        if (method !== "GET" || !["/v1/community/workflow-store/public/list", "/v1/community/workflow-store/public/release"].includes(path)) {
          return fixedError("PUBLIC_WORKFLOW_UNAVAILABLE", 404, "workflow.public.unavailable");
        }
        const parsed = publicQuery(request);
        const result = await http.handle({ ...request, query: parsed.communityQuery });
        if (result?.body?.error) {
          if (result.status === 404) return fixedError("PUBLIC_WORKFLOW_UNAVAILABLE", 404, "workflow.public.unavailable");
          return safeError(result.body.error);
        }
        if (path.endsWith("/list")) {
          const items = (await Promise.all(result.body.items.map((item) => publicWorkflowDto(item, resolvePublicIdentity))))
            .filter((item) => !parsed.riskLevel || item.riskLevel === parsed.riskLevel);
          if (result.body.next !== null && !UUID_PATTERN.test(String(result.body.next))) {
            throw new WorkflowCandidateError("INVALID_IDENTITY_RESPONSE", "workflow public response is invalid", 502);
          }
          return Object.freeze({ ...result, body: Object.freeze({ items, next: result.body.next }) });
        }
        return Object.freeze({ ...result, body: await publicWorkflowDto(result.body, resolvePublicIdentity) });
      }
      if (!enabled && (path.includes("/owner/") || path.includes("/reviewer/"))) {
        return fixedError("FEATURE_DISABLED", 503, "workflow.store.unavailable");
      }
      if (path.includes("/owner/") && !ownerEnabled()) {
        return fixedError("TEMPORARILY_UNAVAILABLE", 503, "workflow.store.unavailable");
      }
      const result = await http.handle(request);
      if (result?.body?.error) return safeError(result.body.error);
      return Object.freeze({
        ...result,
        body: ownerHttpBody(method, path, result.body)
      });
    } catch (error) {
      logError("Identity workflow store request failed", error);
      if ((request?.path || "").startsWith("/v1/community/workflow-store/public/") && (error?.status === 404 || error?.code === "NOT_FOUND")) {
        return fixedError("PUBLIC_WORKFLOW_UNAVAILABLE", 404, "workflow.public.unavailable");
      }
      return safeError(error);
    }
  }

  return Object.freeze({
    capability,
    publicCapability,
    handle,
    submissionLookupEnabled,
    async lookupPublishedRelease(reference) {
      if (!submissionLookupEnabled) return false;
      return candidate.lookupPublishedRelease(reference);
    }
  });
}

module.exports = {
  MAX_REQUEST_BYTES,
  createFixedWorkflowReviewerAuthenticator,
  createIdentityWorkflowStoreGateway
};
