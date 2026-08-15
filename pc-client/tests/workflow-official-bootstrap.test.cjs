"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createCommunityWorkflowCandidate,
  createInMemoryWorkflowRepository
} = require("../community/workflow-persistence.cjs");
const {
  bootstrapOfficialWorkflows,
  bindOfficialWorkflowSourcePosts,
  runOfficialWorkflowBootstrapOneShot,
  validateOfficialWorkflowBootstrapManifest
} = require("../community/workflow-official-bootstrap.cjs");
const { createIdentityWorkflowStoreGateway } = require("../identity/workflow-store.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
  workflowOfficialPublisherIdentityRecord
} = require("../identity/workflow-official-publisher-service-identity.cjs");
const { verifyCatalogRelease } = require("../shared/catalog-release.cjs");
const { workflowDependencyProjection } = require("../shared/active-catalog-products.cjs");

const REVIEWER = "5f16d5ac-6663-5905-b920-c2140ac6769c";
const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "community", "workflow-official-bootstrap-candidate.json"),
  "utf8"
));

function runtime(postIds = ["101", "102", "103"]) {
  let sequence = 0;
  const repository = createInMemoryWorkflowRepository();
  const workflow = createCommunityWorkflowCandidate({
    enabled: true,
    repository,
    resolveOwnerIdentity: (request) => request.officialPublisherIdentityId,
    resolveReviewerIdentity: (request) => request.serviceIdentityId,
    resolvePublicIdentity: async (identityId) => ({ identityId, displayName: "枕星 AI" }),
    hasCanonicalDependency: ({ kind, canonicalId }) => kind === "product" &&
      ["chatgpt-desktop", "codex-cli", "claude-desktop"].includes(canonicalId),
    hasCanonicalLicense: (licenseId) => licenseId === "CC-BY-4.0",
    hasCommunityPost: (postId) => postIds.includes(postId),
    makeId: () => `${String(++sequence).padStart(8, "0")}-1111-4111-8111-111111111111`,
    now: () => `2026-08-09T01:00:${String(sequence).padStart(2, "0")}.000Z`
  });
  const publicGateway = createIdentityWorkflowStoreGateway({
    repository,
    workflowPublicStoreEnabled: true,
    resolvePublicIdentity: async (identityId) => ({ identityId, displayName: "枕星 AI" })
  });
  return { workflow, publicGateway };
}

const validation = {
  verifyCatalogSnapshot: async (snapshot) => snapshot.releaseId === "catalog-v00000007-8c49e1972186-0cec5335" &&
    snapshot.catalogVersion === 7 &&
    snapshot.catalogSha256 === "8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c",
  hasCanonicalDependency: async ({ kind, canonicalId }) => kind === "product" &&
    ["chatgpt-desktop", "codex-cli", "claude-desktop"].includes(canonicalId),
  hasCommunityPost: async (postId) => ["101", "102", "103"].includes(postId)
};

const sourcePosts = Object.freeze([
  Object.freeze({ key: "chatgpt-desktop-research", discussionId: "11", postId: "101" }),
  Object.freeze({ key: "codex-cli-code-review", discussionId: "12", postId: "102" }),
  Object.freeze({ key: "claude-desktop-content", discussionId: "13", postId: "103" })
]);

test("official publisher is one governed organization service identity, not a person or reviewer", () => {
  assert.equal(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID, "46564566-f5f4-599c-8ce5-0609069f5148");
  assert.notEqual(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID, REVIEWER);
  assert.deepEqual(workflowOfficialPublisherIdentityRecord(), {
    id: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    identityKind: "workflow-official-publisher-service",
    status: "disabled",
    email: null,
    normalizedEmail: null,
    phone: null,
    normalizedPhone: null,
    passwordHash: null,
    username: "__workflow_official_publisher_service__",
    normalizedUsername: "__workflow_official_publisher_service__",
    communityUsername: "zx_46564566f5f4599c8ce50609069",
    publicDisplayName: "枕星 AI"
  });
});

test("candidate dependencies exist in the current active verified catalog release", () => {
  const root = path.resolve(__dirname, "..");
  const state = JSON.parse(fs.readFileSync(path.join(
    root, "admin", "published", "catalog-store", "state.json"
  ), "utf8"));
  const channel = JSON.parse(fs.readFileSync(path.join(
    root, "catalog", "channel.server-connected-review.json"
  ), "utf8"));
  const releaseId = state.channels.v2.activeReleaseId;
  const envelope = JSON.parse(fs.readFileSync(path.join(
    root, "admin", "published", "catalog-store", "releases", `${releaseId}.json`
  ), "utf8"));
  const verified = verifyCatalogRelease(envelope, {
    trustedKeys: channel.trustedKeys,
    clientId: "workflow-official-bootstrap-candidate"
  });
  assert.equal(verified.eligible, true);
  assert.equal(releaseId, manifest.catalog.releaseId);
  assert.equal(verified.catalogVersion, manifest.catalog.catalogVersion);
  assert.equal(verified.catalogSha256, manifest.catalog.catalogSha256);
  const projection = workflowDependencyProjection(verified.catalog);
  for (const productId of ["chatgpt-desktop", "codex-cli", "claude-desktop"]) {
    assert.equal(projection.productIds.has(productId), true);
  }
  assert.equal(projection.resourceBindings.size, 0, "no resource tuple may be invented for this active release");
});

test("candidate manifest validates three dependency-exact immutable data-only compositions", async () => {
  const bound = bindOfficialWorkflowSourcePosts(manifest, sourcePosts);
  const normalized = await validateOfficialWorkflowBootstrapManifest(bound, validation);
  assert.equal(normalized.workflows.length, 3);
  assert.deepEqual(normalized.workflows.map((entry) => entry.content.dependencies[0].canonicalId), [
    "chatgpt-desktop", "codex-cli", "claude-desktop"
  ]);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(JSON.stringify(normalized).includes("price"), false);
  assert.equal(JSON.stringify(normalized).includes("command"), false);
  assert.equal(JSON.stringify(normalized).includes("secretPlaceholders\":[{"), false);
});

test("bootstrap is idempotent and uses only owner, reviewer, public and composition seams", async () => {
  const { workflow } = runtime();
  const options = {
    candidate: workflow,
    manifest: bindOfficialWorkflowSourcePosts(manifest, sourcePosts),
    publisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    reviewerIdentityId: REVIEWER,
    validation
  };
  const first = await bootstrapOfficialWorkflows(options);
  const second = await bootstrapOfficialWorkflows(options);

  assert.deepEqual(second, first);
  assert.equal(first.status, "published");
  assert.equal(first.items.length, 3);
  assert.equal(first.items.every((item) => item.version === 1 && item.publiclyVisible === true), true);
  assert.equal((await workflow.public.list({ query: {} })).items.length, 3);
  assert.equal(JSON.stringify(first).includes(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID), false);
  assert.equal(JSON.stringify(first).includes(REVIEWER), false);
  assert.equal(JSON.stringify(first).includes("instructions"), false);
});

test("partial failure compensates only through reviewer unlist and never deletes history", async () => {
  const { workflow } = runtime();
  let reads = 0;
  const wrapped = {
    ...workflow,
    public: {
      ...workflow.public,
      async get(request) {
        reads += 1;
        if (reads === 2) throw new Error("public verification failed");
        return workflow.public.get(request);
      }
    }
  };

  await assert.rejects(() => bootstrapOfficialWorkflows({
    candidate: wrapped,
    manifest: bindOfficialWorkflowSourcePosts(manifest, sourcePosts),
    publisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    reviewerIdentityId: REVIEWER,
    validation
  }), /public verification failed/);
  assert.equal((await workflow.public.list({ query: {} })).items.length, 0);
  assert.equal((await workflow.owner.list({
    officialPublisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    query: {}
  })).items.length, 2, "append-only drafts remain as audit history");
});

test("manifest fails closed on forged catalog, source-post drift, dependency drift, and executable fields", async () => {
  const clone = () => structuredClone(manifest);
  const forgedCatalog = clone();
  forgedCatalog.catalog.catalogSha256 = "0".repeat(64);
  await assert.rejects(
    () => validateOfficialWorkflowBootstrapManifest(forgedCatalog, validation),
    /active signed catalog/
  );

  const forgedSource = clone();
  forgedSource.workflows[0].sourcePostKey = "not-governed";
  assert.throws(() => bindOfficialWorkflowSourcePosts(forgedSource, sourcePosts), /source post/);
  const overflowSource = sourcePosts.map((item, index) => index === 0 ? { ...item, postId: "4294967296" } : item);
  assert.throws(() => bindOfficialWorkflowSourcePosts(manifest, overflowSource), /INT UNSIGNED/);

  const drift = clone();
  drift.workflows[0].content.dependencies[0].canonicalId = "invented-skill";
  await assert.rejects(() => validateOfficialWorkflowBootstrapManifest(
    bindOfficialWorkflowSourcePosts(drift, sourcePosts), validation
  ), /canonical dependency/);

  const executable = clone();
  executable.workflows[0].composition.steps[0].command = "run";
  assert.throws(() => bindOfficialWorkflowSourcePosts(executable, sourcePosts), /composition/);
});

test("manifest-controlled one-shot freezes real posts, provisions before writes, and verifies outer DTO list/detail", async () => {
  const { workflow, publicGateway } = runtime();
  const calls = [];
  let provisioned = false;
  const options = {
    candidate: workflow,
    publicGateway,
    bootstrapManifest: manifest,
    sourcePostManifest: { schemaVersion: 1, candidateOnly: true, manifestId: "source", posts: [] },
    requestFlarum: async () => { throw new Error("not used by injected seam"); },
    ensureSourcePosts: async () => {
      calls.push("posts");
      return { items: sourcePosts, created: sourcePosts, receipt: Object.freeze({}) };
    },
    rollbackSourcePosts: async () => { calls.push("rollback-posts"); return { removed: 3 }; },
    provisionPublisher: async () => {
      calls.push("publisher");
      provisioned = true;
      return { created: true, receipt: Object.freeze({}) };
    },
    rollbackPublisher: async () => { calls.push("rollback-publisher"); return { removed: true }; },
    validation
  };
  const first = await runOfficialWorkflowBootstrapOneShot(options);
  const second = await runOfficialWorkflowBootstrapOneShot({
    ...options,
    ensureSourcePosts: async () => ({ items: sourcePosts, created: [], receipt: Object.freeze({}) }),
    provisionPublisher: async () => ({ created: false, receipt: null })
  });

  assert.equal(provisioned, true);
  assert.deepEqual(calls, ["posts", "publisher"]);
  assert.equal(first.items.length, 3);
  assert.deepEqual(second, first);
  assert.equal(first.execution, false);
  assert.equal(JSON.stringify(first).includes("identityId"), false);
  assert.equal(JSON.stringify(first).includes(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID), false);
  assert.equal(JSON.stringify(first).includes(REVIEWER), false);
});

test("one-shot rolls back only unreferenced current-run sources and retains history after Workflow writes", async () => {
  const beforeWrite = [];
  await assert.rejects(() => runOfficialWorkflowBootstrapOneShot({
    candidate: runtime().workflow,
    publicGateway: runtime().publicGateway,
    bootstrapManifest: manifest,
    sourcePostManifest: {},
    requestFlarum: async () => {},
    ensureSourcePosts: async () => ({ items: sourcePosts, created: sourcePosts, receipt: Object.freeze({}) }),
    rollbackSourcePosts: async () => { beforeWrite.push("posts"); },
    provisionPublisher: async () => { throw new Error("publisher failed"); },
    rollbackPublisher: async () => { beforeWrite.push("publisher"); },
    validation
  }), /publisher failed/);
  assert.deepEqual(beforeWrite, ["posts"]);

  const { workflow, publicGateway } = runtime();
  const afterWrite = [];
  const failingGateway = {
    async handle(request) {
      if (request.path.endsWith("/list")) return { status: 502, body: { error: {} } };
      return publicGateway.handle(request);
    }
  };
  await assert.rejects(() => runOfficialWorkflowBootstrapOneShot({
    candidate: workflow,
    publicGateway: failingGateway,
    bootstrapManifest: manifest,
    sourcePostManifest: {},
    requestFlarum: async () => {},
    ensureSourcePosts: async () => ({ items: sourcePosts, created: sourcePosts, receipt: Object.freeze({}) }),
    rollbackSourcePosts: async () => { afterWrite.push("posts"); },
    provisionPublisher: async () => ({ created: true, receipt: Object.freeze({}) }),
    rollbackPublisher: async () => { afterWrite.push("publisher"); },
    validation
  }), /outer public/);
  assert.deepEqual(afterWrite, []);
  assert.equal((await workflow.public.list({ query: {} })).items.length, 0, "published listings are compensated by unlist");
  assert.equal((await workflow.owner.list({
    officialPublisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    query: {}
  })).items.length, 3, "append-only audit history remains");
});

test("official publisher migration stays candidate-only and bans browser relations", () => {
  const root = path.resolve(__dirname, "..");
  const runtimeSchema = fs.readFileSync(path.join(root, "identity", "schema.sql"), "utf8");
  const migration = fs.readFileSync(path.join(
    root, "identity", "migrations", "candidates", "0003-workflow-official-publisher-service-identity.sql"
  ), "utf8");
  assert.doesNotMatch(runtimeSchema, /workflow-official-publisher-service/);
  assert.match(migration, /identity_kind = 'workflow-official-publisher-service'/);
  assert.match(migration, /community_profiles/);
  assert.match(migration, /profile_avatars/);
  assert.match(migration, /devices/);
  assert.match(migration, /sessions/);
});
