"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createInMemoryWorkflowRepository
} = require("../community/workflow-persistence.cjs");
const {
  createFixedWorkflowReviewerAuthenticator,
  createIdentityWorkflowStoreGateway
} = require("../identity/workflow-store.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("../identity/workflow-official-publisher-service-identity.cjs");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const REVIEWER = "22222222-2222-4222-8222-222222222222";
const SECRET = "workflow-review-secret-32-bytes-minimum";

function content(title = "Data-only workflow") {
  return {
    title,
    summary: "Only human-readable steps and canonical dependencies.",
    inputs: [],
    outputs: [],
    instructions: ["Open the target product and follow the documented steps."],
    dependencies: [{ kind: "product", canonicalId: "comfyui", permissions: ["none"] }],
    secretPlaceholders: []
  };
}

function createBody() {
  return {
    sourceCommunityPostId: "42",
    provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] },
    content: content()
  };
}

function gateway(overrides = {}) {
  const repository = overrides.repository || createInMemoryWorkflowRepository();
  return createIdentityWorkflowStoreGateway({
    workflowStoreEnabled: true,
    resourceSubmissionsEnabled: true,
    workflowSubmissionLookupEnabled: true,
    repository,
    resolveOwnerIdentity: async (request) => {
      if (request.accessToken === "owner-token") return AUTHOR;
      if (request.accessToken === "other-token") return REVIEWER;
      return null;
    },
    authenticateReviewer: createFixedWorkflowReviewerAuthenticator({
      secret: SECRET,
      reviewerIdentityId: REVIEWER
    }),
    resolvePublicIdentity: async (identityId) => ({ identityId, displayName: "Current author" }),
    hasCanonicalDependency: async (tuple) => tuple.kind === "product" && tuple.canonicalId === "comfyui",
    hasCanonicalLicense: async (licenseId) => licenseId === "CC-BY-4.0",
    hasCommunityPost: async (postId) => postId === "42",
    makeId: (() => {
      const ids = [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      ];
      return () => ids.shift();
    })(),
    now: (() => {
      let tick = 0;
      return () => `2026-08-07T02:00:0${tick++}.000Z`;
    })(),
    ...overrides
  });
}

async function request(instance, method, path, { token, secret, body, query, idempotencyKey } = {}) {
  return instance.handle({
    method,
    path,
    accessToken: token || "",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(secret ? { "x-aihub-workflow-review-secret": secret } : {}),
      ...(body ? { "idempotency-key": idempotencyKey || `${method}-${path}-${body.expectedRevision || "create"}` } : {})
    },
    body,
    query: query || {}
  });
}

test("Identity workflow gateway is fail-closed unless all three gates and real dependencies are present", async () => {
  for (const disabled of [
    { workflowStoreEnabled: false },
    { resourceSubmissionsEnabled: false },
    { workflowSubmissionLookupEnabled: false },
    { hasCommunityPost: undefined }
  ]) {
    const instance = gateway(disabled);
    assert.equal(instance.submissionLookupEnabled, false);
    assert.equal(instance.capability().workflowSubmissionLookup, false);
  }

  const enabled = gateway();
  assert.equal(enabled.capability().enabled, true);
  assert.equal(enabled.submissionLookupEnabled, true);
});

test("owner capability stays unavailable until the verified catalog projection is ready", async () => {
  let ready = false;
  let prepares = 0;
  const instance = gateway({
    isCanonicalDependencyReady: () => ready,
    prepareCanonicalDependencies: async () => { prepares += 1; }
  });
  assert.deepEqual(instance.capability(), {
    enabled: false,
    schemaVersion: 1,
    execution: false,
    workflowSubmissionLookup: false
  });
  const cold = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody()
  });
  assert.equal(cold.status, 503);
  assert.equal(cold.body.error.code, "TEMPORARILY_UNAVAILABLE");
  assert.equal(prepares >= 1, true);

  ready = true;
  assert.equal(instance.capability().enabled, true);
  const created = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody(),
    idempotencyKey: "ready-create"
  });
  assert.equal(created.status, 201);
});

test("Identity derives the owner, isolates reviewer S2S, and keeps public DTO separate", async () => {
  const instance = gateway({ workflowPublicStoreEnabled: true });
  const anonymous = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    body: createBody()
  });
  assert.equal(anonymous.status, 401);
  assert.deepEqual(Object.keys(anonymous.body.error).sort(), ["code", "messageKey", "status"]);

  const created = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody()
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.workflowId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(JSON.stringify(created.body).includes("authorIdentityId"), false);
  assert.doesNotMatch(JSON.stringify(created.body), /reviewer|riskLevel|audit/i);

  const page = await request(instance, "GET", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    query: { limit: 1 }
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.items.length, 1);
  assert.doesNotMatch(JSON.stringify(page.body), /reviewer|riskLevel|audit/i);
  const isolated = await request(instance, "GET", "/v1/community/workflow-store/owner/draft", {
    token: "other-token",
    query: { workflowId: created.body.workflowId }
  });
  assert.equal(isolated.status, 404);

  const submitted = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "owner-token",
    body: { workflowId: created.body.workflowId, expectedRevision: created.body.expectedRevision }
  });
  assert.equal(submitted.status, 200);

  const unauthenticatedReview = await request(instance, "POST", "/v1/community/workflow-store/reviewer/review", {
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  assert.equal(unauthenticatedReview.status, 403);

  const reviewed = await request(instance, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  assert.equal(reviewed.status, 200);
  assert.equal(await instance.lookupPublishedRelease({ workflowId: created.body.workflowId, version: 1 }), true);

  const publicRelease = await request(instance, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: created.body.workflowId, version: 1 }
  });
  assert.equal(publicRelease.status, 200);
  assert.deepEqual(publicRelease.body.author, { displayName: "Current author" });
  assert.equal(publicRelease.body.originalAuthorDisplayName, "Current author");
  assert.doesNotMatch(JSON.stringify(publicRelease.body), /identityId/);
  assert.doesNotMatch(JSON.stringify(publicRelease.body), /reviewer|audit|discoveredVia|credential/i);

  const unlisted = await request(instance, "POST", "/v1/community/workflow-store/reviewer/unlist", {
    secret: SECRET,
    body: {
      workflowId: created.body.workflowId,
      reason: "Temporarily hidden while provenance is reviewed."
    }
  });
  assert.equal(unlisted.status, 200);
  assert.equal(await instance.lookupPublishedRelease({ workflowId: created.body.workflowId, version: 1 }), false);
});

test("reviewer identity cannot be supplied by an HTTP body and safe errors contain no diagnostics", async () => {
  const instance = gateway();
  const result = await request(instance, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedRevision: 1,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low",
      reviewerId: REVIEWER
    }
  });
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body.error).sort(), ["code", "messageKey", "status"]);
  assert.doesNotMatch(JSON.stringify(result.body), /sql|postgres|https?:|secret|reviewer|stack/i);

  const oversized = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: { ...createBody(), padding: "x".repeat(129 * 1024) }
  });
  assert.deepEqual(oversized, {
    status: 400,
    body: { error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" } }
  });

  const inherited = Object.assign(Object.create({ identityId: AUTHOR }), createBody());
  const prototypeResult = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: inherited
  });
  assert.equal(prototypeResult.status, 400);
});

test("public read capability is independent, exact, allowlisted, and fail-closed", async () => {
  const repository = createInMemoryWorkflowRepository();
  const writer = gateway({ repository });
  const created = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody()
  });
  const submitted = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "owner-token",
    body: { workflowId: created.body.workflowId, expectedRevision: created.body.expectedRevision }
  });
  await request(writer, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded"
    }
  });
  const rejectedDraft = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody(),
    idempotencyKey: "rejected-create"
  });
  const rejectedSubmission = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "owner-token",
    body: { workflowId: rejectedDraft.body.workflowId, expectedRevision: rejectedDraft.body.expectedRevision },
    idempotencyKey: "rejected-submit"
  });
  const rejectedReview = await request(writer, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: rejectedDraft.body.workflowId,
      expectedRevision: rejectedSubmission.body.expectedRevision,
      decision: "reject",
      reviewStatus: "rejected",
      riskLevel: "unsafe",
      reason: "Unsafe candidate fixture."
    },
    idempotencyKey: "rejected-review"
  });
  assert.equal(rejectedReview.status, 200, JSON.stringify(rejectedReview));

  const publicOnly = gateway({
    repository,
    workflowStoreEnabled: false,
    workflowPublicStoreEnabled: true,
    resourceSubmissionsEnabled: false,
    workflowSubmissionLookupEnabled: false,
    resolveOwnerIdentity: undefined,
    authenticateReviewer: undefined,
    hasCanonicalDependency: undefined,
    hasCanonicalLicense: undefined,
    hasCommunityPost: undefined
  });
  assert.deepEqual(publicOnly.publicCapability(), {
    enabled: true,
    schemaVersion: 1,
    execution: false
  });
  assert.equal(publicOnly.capability().enabled, false);

  const capability = await request(publicOnly, "GET", "/v1/community/workflow-store/public/capability");
  assert.deepEqual(capability, { status: 200, body: publicOnly.publicCapability() });
  assert.deepEqual(await request(publicOnly, "POST", "/v1/community/workflow-store/public/list", { body: {} }), {
    status: 404,
    body: { error: { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: 404, messageKey: "workflow.public.unavailable" } }
  });
  const page = await request(publicOnly, "GET", "/v1/community/workflow-store/public/list", {
    query: { limit: 10, riskLevel: "guarded" }
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.items.length, 1);
  const release = page.body.items[0];
  assert.deepEqual(Object.keys(release).sort(), [
    "author", "content", "originalAuthorDisplayName", "provenance", "releasedAt", "requiresPerUseConfirmation",
    "reviewStatus", "riskLevel", "sourceCommunityPostId", "version", "workflowId"
  ]);
  assert.deepEqual(release.author, { displayName: "Current author" });
  assert.equal(release.originalAuthorDisplayName, "Current author");
  assert.deepEqual(Object.keys(release.provenance).sort(), ["canonicalSource", "derivedFrom", "licenseId"]);
  assert.doesNotMatch(JSON.stringify(release), /identityId|reviewer|owner|audit|internal|evidence|https?:|secret/i);

  const exact = await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: release.workflowId, version: release.version }
  });
  assert.equal(exact.status, 200);
  const invalid = await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: release.workflowId, version: release.version, url: "https://forbidden.test" }
  });
  assert.equal(invalid.status, 400);

  await request(writer, "POST", "/v1/community/workflow-store/reviewer/unlist", {
    secret: SECRET,
    body: { workflowId: release.workflowId, reason: "Temporary public hold." }
  });
  const unavailable = await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: release.workflowId, version: release.version }
  });
  const unavailableExact = {
    status: 404,
    body: { error: { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: 404, messageKey: "workflow.public.unavailable" } }
  };
  assert.deepEqual(unavailable, unavailableExact);
  assert.deepEqual(await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: rejectedDraft.body.workflowId, version: 1 }
  }), unavailableExact);
  assert.deepEqual(await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", version: 1 }
  }), unavailableExact);
});

test("official publisher attribution stays human-readable while outer public DTO strips service internals", async () => {
  const repository = createInMemoryWorkflowRepository();
  const instance = gateway({
    repository,
    workflowPublicStoreEnabled: true,
    resolveOwnerIdentity: async (request) => request.accessToken === "official-publisher-token"
      ? WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
      : null,
    resolvePublicIdentity: async (identityId) => identityId === WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
      ? { identityId, displayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME }
      : null
  });
  const created = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "official-publisher-token",
    body: createBody(),
    idempotencyKey: "official-publisher-create"
  });
  const submitted = await request(instance, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "official-publisher-token",
    body: { workflowId: created.body.workflowId, expectedRevision: created.body.expectedRevision },
    idempotencyKey: "official-publisher-submit"
  });
  await request(instance, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    },
    idempotencyKey: "official-publisher-review"
  });
  const result = await request(instance, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: created.body.workflowId, version: 1 }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.author, { displayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME });
  assert.equal(result.body.originalAuthorDisplayName, WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME);
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /46564566-f5f4-599c-8ce5-0609069f5148|workflow-official-publisher-service|identityId|identityKind/
  );
});

test("optional original-author display lookup never guesses and fails open without leaking identity fields", async () => {
  const repository = createInMemoryWorkflowRepository();
  const writer = gateway({ repository });
  const created = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "owner-token",
    body: createBody()
  });
  const submitted = await request(writer, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "owner-token",
    body: { workflowId: created.body.workflowId, expectedRevision: created.body.expectedRevision }
  });
  await request(writer, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: SECRET,
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });

  for (const invalidProfile of [
    null,
    { identityId: AUTHOR, displayName: "" },
    { identityId: AUTHOR, displayName: "<b>Original</b>" },
    { identityId: AUTHOR, displayName: "Original &lt;author&gt;" },
    { identityId: AUTHOR, displayName: "https://identity.example/original" },
    { identityId: AUTHOR, displayName: "Original\u0000author" },
    { identityId: AUTHOR, displayName: "secret token owner" },
    { identityId: AUTHOR, displayName: "x".repeat(161) },
    { identityId: AUTHOR, displayName: "Original author", organization: "Untrusted organization" },
    { identityId: REVIEWER, displayName: "Wrong identity" }
  ]) {
    let callCount = 0;
    const publicOnly = gateway({
      repository,
      workflowStoreEnabled: false,
      workflowPublicStoreEnabled: true,
      resourceSubmissionsEnabled: false,
      workflowSubmissionLookupEnabled: false,
      resolveOwnerIdentity: undefined,
      authenticateReviewer: undefined,
      hasCanonicalDependency: undefined,
      hasCanonicalLicense: undefined,
      hasCommunityPost: undefined,
      resolvePublicIdentity: async (identityId) => {
        callCount += 1;
        if (callCount === 1) return { identityId, displayName: "Current submitter" };
        if (invalidProfile === null) throw new Error("private identity lookup diagnostic");
        return invalidProfile;
      }
    });
    const result = await request(publicOnly, "GET", "/v1/community/workflow-store/public/release", {
      query: { workflowId: created.body.workflowId, version: 1 }
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.author, { displayName: "Current submitter" });
    assert.equal(Object.hasOwn(result.body, "originalAuthorDisplayName"), false);
    assert.doesNotMatch(JSON.stringify(result.body), /identityId|Untrusted organization|Wrong identity|private identity/i);
  }
});
