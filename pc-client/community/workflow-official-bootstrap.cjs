"use strict";

const { normalizeWorkflowComposition } = require("./workflow-composition.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("../identity/workflow-official-publisher-service-identity.cjs");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
} = require("../identity/workflow-reviewer-service-identity.cjs");
const {
  ensureOfficialSourcePosts,
  rollbackOfficialSourcePosts
} = require("./workflow-official-source-posts.cjs");

const SYNTHETIC_WORKFLOW_ID = "00000000-0000-4000-8000-000000000001";
const FORBIDDEN_FIELDS = new Set([
  "command", "args", "env", "headers", "credentials", "endpoint", "script", "url", "path",
  "secret", "secretValue", "token", "password",
  "nodes", "dependsOn", "price", "currency", "order", "payment", "entitlement"
]);

function fail(message) {
  const error = new Error(message);
  error.code = "OFFICIAL_WORKFLOW_BOOTSTRAP_INVALID";
  throw error;
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(value, fields) {
  if (!plainObject(value) || Object.keys(value).length !== fields.length ||
      fields.some((field) => !Object.hasOwn(value, field))) fail("bootstrap manifest fields are invalid");
  return value;
}

function safeTree(value) {
  if (typeof value === "string" && (/https?:\/\//i.test(value) || /[A-Za-z]:\\/.test(value))) {
    fail("bootstrap manifest contains an arbitrary URL or path");
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) fail("bootstrap composition contains a forbidden field");
    safeTree(child);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalPostId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 4294967295) {
    fail("bootstrap Flarum post ID must fit INT UNSIGNED");
  }
  return value;
}

function bindOfficialWorkflowSourcePosts(manifest, sourcePosts) {
  exact(manifest, [
    "schemaVersion", "candidateOnly", "bootstrapId", "publisher",
    "reviewerIdentityId", "catalog", "workflows"
  ]);
  safeTree(manifest);
  if (!Array.isArray(manifest.workflows) || !Array.isArray(sourcePosts) ||
      manifest.workflows.length !== sourcePosts.length) {
    fail("bootstrap source post set is invalid");
  }
  const byKey = new Map();
  for (const source of sourcePosts) {
    exact(source, ["key", "discussionId", "postId"]);
    if (typeof source.key !== "string" || byKey.has(source.key)) fail("bootstrap source post set is invalid");
    byKey.set(source.key, canonicalPostId(source.postId));
  }
  const used = new Set();
  const bound = structuredClone(manifest);
  bound.workflows = bound.workflows.map((workflow) => {
    exact(workflow, ["key", "sourcePostKey", "provenance", "content", "composition", "review"]);
    const postId = byKey.get(workflow.sourcePostKey);
    if (!postId || used.has(workflow.sourcePostKey)) fail("bootstrap source post key is missing or duplicated");
    used.add(workflow.sourcePostKey);
    const result = { ...workflow, sourceCommunityPostId: postId };
    delete result.sourcePostKey;
    return result;
  });
  if (used.size !== byKey.size) fail("bootstrap source post set contains an extra entry");
  return deepFreeze(bound);
}

async function requireLiteralTrue(resolver, value, message) {
  let result = false;
  try {
    result = await resolver(value);
  } catch {
    result = false;
  }
  if (result !== true) fail(message);
}

async function validateOfficialWorkflowBootstrapManifest(manifest, {
  verifyCatalogSnapshot,
  hasCanonicalDependency,
  hasCommunityPost
} = {}) {
  if ([verifyCatalogSnapshot, hasCanonicalDependency, hasCommunityPost].some((value) => typeof value !== "function")) {
    throw new TypeError("official Workflow bootstrap validators are required");
  }
  exact(manifest, [
    "schemaVersion", "candidateOnly", "bootstrapId", "publisher",
    "reviewerIdentityId", "catalog", "workflows"
  ]);
  safeTree(manifest);
  if (manifest.schemaVersion !== 1 || manifest.candidateOnly !== true ||
      typeof manifest.bootstrapId !== "string" || !/^[a-z0-9][a-z0-9-]{7,99}$/.test(manifest.bootstrapId)) {
    fail("bootstrap manifest identity is invalid");
  }
  exact(manifest.publisher, ["identityId", "displayName"]);
  if (manifest.publisher.identityId !== WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID ||
      manifest.publisher.displayName !== WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME ||
      manifest.reviewerIdentityId !== WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID) {
    fail("bootstrap service identities do not match the governed contract");
  }
  exact(manifest.catalog, ["releaseId", "catalogVersion", "catalogSha256"]);
  if (!/^catalog-v[0-9]{8}-[a-f0-9]{12}-[a-f0-9]{8}$/.test(manifest.catalog.releaseId) ||
      !Number.isSafeInteger(manifest.catalog.catalogVersion) || manifest.catalog.catalogVersion < 1 ||
      !/^[a-f0-9]{64}$/.test(manifest.catalog.catalogSha256)) {
    fail("bootstrap catalog snapshot is invalid");
  }
  await requireLiteralTrue(verifyCatalogSnapshot, manifest.catalog, "bootstrap catalog is not the active signed catalog");
  if (!Array.isArray(manifest.workflows) || manifest.workflows.length < 3 || manifest.workflows.length > 5) {
    fail("bootstrap manifest must contain 3-5 workflows");
  }

  const keys = new Set();
  const posts = new Set();
  for (const workflow of manifest.workflows) {
    exact(workflow, ["key", "sourceCommunityPostId", "provenance", "content", "composition", "review"]);
    if (typeof workflow.key !== "string" || !/^[a-z][a-z0-9-]{2,63}$/.test(workflow.key) || keys.has(workflow.key)) {
      fail("bootstrap workflow key is invalid or duplicated");
    }
    keys.add(workflow.key);
    const postId = canonicalPostId(workflow.sourceCommunityPostId);
    if (posts.has(postId)) fail("bootstrap Flarum posts must be unique");
    posts.add(postId);
    await requireLiteralTrue(hasCommunityPost, postId, "bootstrap requires an exact real Flarum post");
    exact(workflow.provenance, ["licenseId", "derivedFrom", "discoveredVia"]);
    if (workflow.provenance.licenseId !== "CC-BY-4.0" ||
        !Array.isArray(workflow.provenance.derivedFrom) || workflow.provenance.derivedFrom.length !== 0 ||
        !Array.isArray(workflow.provenance.discoveredVia) || workflow.provenance.discoveredVia.length !== 0) {
      fail("bootstrap provenance is outside the official starter contract");
    }
    if (!Array.isArray(workflow.content?.dependencies) || workflow.content.dependencies.length < 1 ||
        !Array.isArray(workflow.content.secretPlaceholders) || workflow.content.secretPlaceholders.length !== 0) {
      fail("bootstrap content dependencies or secret placeholders are invalid");
    }
    for (const dependency of workflow.content.dependencies) {
      const tuple = dependency.kind === "resource"
        ? { kind: dependency.kind, canonicalId: dependency.canonicalId, hostProductId: dependency.hostProductId, bindingKind: dependency.bindingKind }
        : { kind: dependency.kind, canonicalId: dependency.canonicalId };
      await requireLiteralTrue(hasCanonicalDependency, tuple, "bootstrap contains a non-canonical dependency");
    }
    exact(workflow.composition, ["steps"]);
    exact(workflow.review, ["reviewStatus", "riskLevel"]);
    if (!['automated-reviewed', 'manually-reviewed'].includes(workflow.review.reviewStatus) ||
        !['low', 'guarded'].includes(workflow.review.riskLevel)) {
      fail("bootstrap review projection is not public-safe");
    }
    try {
      normalizeWorkflowComposition({
        workflowRelease: {
          workflowId: SYNTHETIC_WORKFLOW_ID,
          version: 1,
          content: workflow.content
        },
        steps: workflow.composition.steps
      });
    } catch (error) {
      fail(`bootstrap composition is invalid: ${error.code || "INVALID"}`);
    }
  }
  return deepFreeze(structuredClone(manifest));
}

function request(key, body, identity = {}) {
  return {
    ...identity,
    headers: { "idempotency-key": key },
    body
  };
}

async function bootstrapOfficialWorkflows({
  candidate,
  manifest,
  publisherIdentityId,
  reviewerIdentityId,
  validation
} = {}) {
  if (!candidate?.owner || !candidate?.reviewer || !candidate?.public) {
    throw new TypeError("existing Workflow candidate adapters are required");
  }
  const normalized = await validateOfficialWorkflowBootstrapManifest(manifest, validation);
  if (publisherIdentityId !== normalized.publisher.identityId || reviewerIdentityId !== normalized.reviewerIdentityId) {
    fail("bootstrap runtime identities do not match the manifest");
  }
  const published = [];
  try {
    for (const workflow of normalized.workflows) {
      const prefix = `${normalized.bootstrapId}:${workflow.key}`;
      const created = await candidate.owner.create(request(
        `${prefix}:create`,
        {
          sourceCommunityPostId: workflow.sourceCommunityPostId,
          provenance: workflow.provenance,
          content: workflow.content
        },
        { officialPublisherIdentityId: publisherIdentityId }
      ));
      const submitted = await candidate.owner.submit(request(
        `${prefix}:submit`,
        { workflowId: created.workflowId, expectedRevision: created.expectedRevision },
        { officialPublisherIdentityId: publisherIdentityId }
      ));
      const reviewed = await candidate.reviewer.review(request(
        `${prefix}:review`,
        {
          workflowId: created.workflowId,
          expectedRevision: submitted.expectedRevision,
          decision: "publish",
          reviewStatus: workflow.review.reviewStatus,
          riskLevel: workflow.review.riskLevel
        },
        { serviceIdentityId: reviewerIdentityId }
      ));
      published.push({ workflow, reviewed });
      normalizeWorkflowComposition({
        workflowRelease: reviewed.release,
        steps: workflow.composition.steps
      });
      const publicRelease = await candidate.public.get({
        query: { workflowId: reviewed.release.workflowId, version: reviewed.release.version }
      });
      if (publicRelease.workflowId !== reviewed.release.workflowId || publicRelease.version !== 1 ||
          publicRelease.author?.displayName !== WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME) {
        fail("bootstrap public release projection did not match");
      }
    }
  } catch (error) {
    for (const { workflow, reviewed } of [...published].reverse()) {
      await candidate.reviewer.unlist(request(
        `${normalized.bootstrapId}:${workflow.key}:compensating-unlist`,
        { workflowId: reviewed.release.workflowId, reason: "official bootstrap verification failed" },
        { serviceIdentityId: reviewerIdentityId }
      )).catch(() => {});
    }
    throw error;
  }

  return deepFreeze({
    status: "published",
    execution: false,
    items: published.map(({ reviewed }) => ({
      workflowId: reviewed.release.workflowId,
      version: reviewed.release.version,
      title: reviewed.release.content.title,
      summary: reviewed.release.content.summary,
      reviewStatus: reviewed.release.reviewStatus,
      riskLevel: reviewed.release.riskLevel,
      publiclyVisible: reviewed.listing.publiclyVisible === true
    }))
  });
}

function publicProjectionIsSafe(value) {
  const forbidden = new Set([
    "identityId", "reviewerId", "reviewedBy", "audit", "internalNotes",
    "secretPlaceholders", "price", "currency", "order", "payment", "entitlement"
  ]);
  function visit(node) {
    if (!node || typeof node !== "object") return true;
    return Object.entries(node).every(([key, child]) => !forbidden.has(key) && visit(child));
  }
  return visit(value);
}

async function verifyOuterPublicWorkflows(publicGateway, expected) {
  if (typeof publicGateway?.handle !== "function") throw new TypeError("Identity Workflow public gateway is required");
  const listed = await publicGateway.handle({
    method: "GET",
    path: "/v1/community/workflow-store/public/list",
    query: { limit: 50 }
  });
  if (listed?.status !== 200 || !Array.isArray(listed.body?.items) || listed.body.items.length !== expected.length ||
      listed.body.next !== null || !publicProjectionIsSafe(listed.body)) {
    fail("bootstrap outer public list verification failed");
  }
  const expectedKeys = new Set(expected.map((item) => `${item.workflowId}:${item.version}`));
  const listedKeys = new Set(listed.body.items.map((item) => `${item.workflowId}:${item.version}`));
  if (listedKeys.size !== expectedKeys.size || [...expectedKeys].some((key) => !listedKeys.has(key))) {
    fail("bootstrap outer public list verification failed");
  }
  for (const item of expected) {
    const detail = await publicGateway.handle({
      method: "GET",
      path: "/v1/community/workflow-store/public/release",
      query: { workflowId: item.workflowId, version: item.version }
    });
    if (detail?.status !== 200 || detail.body?.workflowId !== item.workflowId || detail.body?.version !== item.version ||
        detail.body?.author?.displayName !== WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME ||
        !publicProjectionIsSafe(detail.body)) {
      fail("bootstrap outer public detail verification failed");
    }
  }
  return true;
}

async function compensateOfficialWorkflowListings(candidate, manifest, items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const workflow = manifest.workflows[index];
    await candidate.reviewer.unlist(request(
      `${manifest.bootstrapId}:${workflow.key}:compensating-unlist`,
      { workflowId: item.workflowId, reason: "official bootstrap verification failed" },
      { serviceIdentityId: manifest.reviewerIdentityId }
    )).catch(() => {});
  }
}

async function workflowReferencesSourcePosts(candidate, publisherIdentityId, sourcePosts) {
  try {
    const owned = await candidate.owner.list({
      officialPublisherIdentityId: publisherIdentityId,
      query: {}
    });
    const postIds = new Set(sourcePosts.map((item) => item.postId));
    return !Array.isArray(owned?.items) || owned.items.some((item) => postIds.has(item.sourceCommunityPostId));
  } catch {
    return true;
  }
}

async function runOfficialWorkflowBootstrapOneShot({
  candidate,
  publicGateway,
  bootstrapManifest,
  sourcePostManifest,
  requestFlarum,
  ensureSourcePosts = ensureOfficialSourcePosts,
  rollbackSourcePosts = rollbackOfficialSourcePosts,
  provisionPublisher,
  rollbackPublisher,
  validation
} = {}) {
  if (typeof ensureSourcePosts !== "function" || typeof rollbackSourcePosts !== "function" ||
      typeof provisionPublisher !== "function" || typeof rollbackPublisher !== "function") {
    throw new TypeError("official Workflow one-shot dependencies are required");
  }
  let sourceResult;
  let publisherResult;
  let publishedResult;
  try {
    sourceResult = await ensureSourcePosts({ manifest: sourcePostManifest, requestFlarum });
    const boundManifest = bindOfficialWorkflowSourcePosts(bootstrapManifest, sourceResult.items);
    publisherResult = await provisionPublisher();
    publishedResult = await bootstrapOfficialWorkflows({
      candidate,
      manifest: boundManifest,
      publisherIdentityId: boundManifest.publisher.identityId,
      reviewerIdentityId: boundManifest.reviewerIdentityId,
      validation
    });
    try {
      await verifyOuterPublicWorkflows(publicGateway, publishedResult.items);
    } catch (error) {
      await compensateOfficialWorkflowListings(candidate, boundManifest, publishedResult.items);
      throw error;
    }
    return publishedResult;
  } catch (error) {
    const referenced = sourceResult
      ? await workflowReferencesSourcePosts(candidate, bootstrapManifest?.publisher?.identityId, sourceResult.items)
      : true;
    if (!referenced) {
      if (publisherResult?.created === true && publisherResult.receipt) {
        await rollbackPublisher(publisherResult.receipt).catch(() => {});
      }
      if (sourceResult?.receipt) {
        await rollbackSourcePosts({
          manifest: sourcePostManifest,
          receipt: sourceResult.receipt,
          requestFlarum
        }).catch(() => {});
      }
    }
    throw error;
  }
}

module.exports = {
  bindOfficialWorkflowSourcePosts,
  bootstrapOfficialWorkflows,
  runOfficialWorkflowBootstrapOneShot,
  validateOfficialWorkflowBootstrapManifest
};
