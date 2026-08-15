"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const existingStatePath = path.join(
  root,
  "deployment",
  "community-production",
  "workflow-production-existing-state.cjs"
);
const {
  bindOfficialWorkflowSourcePosts,
  bootstrapOfficialWorkflows
} = require("../community/workflow-official-bootstrap.cjs");
const {
  createCommunityWorkflowCandidate
} = require("../community/workflow-persistence.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("../identity/workflow-official-publisher-service-identity.cjs");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
} = require("../identity/workflow-reviewer-service-identity.cjs");

const FLAG_KEYS = [
  "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
  "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
  "AIHUB_WORKFLOW_STORE_ENABLED",
  "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
  "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
  "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
];
const SOURCE_ITEMS = [
  { key: "chatgpt-desktop-research", discussionId: "101", postId: "201" },
  { key: "codex-cli-code-review", discussionId: "102", postId: "202" },
  { key: "claude-desktop-content", discussionId: "103", postId: "203" }
];

function identityInspect(enabled) {
  const value = enabled ? "1" : "0";
  return [{ Config: { Env: FLAG_KEYS.map((key) => `${key}=${value}`) } }];
}

function identityInspectProfile(values) {
  return [{ Config: { Env: FLAG_KEYS.map((key, index) => `${key}=${values[index]}`) } }];
}

function sourceState(items) {
  return {
    schema: "aihub-workflow-official-source-post-readback-v1",
    status: "pass",
    checkedKeys: SOURCE_ITEMS.map((item) => item.key),
    sourcePostCount: items.length,
    items
  };
}

function commonDatabase(overrides = {}) {
  return {
    schemaState: "present|present|present",
    appendOnlyTriggers: 1,
    eventHeadRows: 1,
    eventHead: 0,
    reviewerExact: 1,
    reviewerForbiddenRelations: 0,
    publisherExact: 0,
    publisherForbiddenRelations: 0,
    officialSourceMarkerDiscussions: 0,
    events: [],
    idempotency: [],
    ...overrides
  };
}

function clone(value) {
  return structuredClone(value);
}

async function retainedFixture() {
  const bootstrapManifest = JSON.parse(fs.readFileSync(
    path.join(root, "community", "workflow-official-bootstrap-candidate.json"),
    "utf8"
  ));
  const boundManifest = bindOfficialWorkflowSourcePosts(bootstrapManifest, SOURCE_ITEMS);
  const events = [];
  const idempotency = [];
  const repository = {
    async loadEvents() { return clone(events); },
    async getIdempotency(actorIdentityId, keyHash) {
      const row = idempotency.find((entry) => entry.actorIdentityId === actorIdentityId && entry.keyHash === keyHash);
      return row ? { requestHash: row.requestHash, response: clone(row.response) } : null;
    },
    async commit({ expectedSequence, event, idempotency: entry }) {
      assert.equal(expectedSequence, events.length);
      const sequence = events.length + 1;
      events.push({ sequence, ...clone(event) });
      idempotency.push({ ...clone(entry), eventSequence: sequence });
      return clone(entry.response);
    }
  };
  const generatedIds = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333"
  ];
  let instant = 0;
  const candidate = createCommunityWorkflowCandidate({
    enabled: true,
    repository,
    resolveOwnerIdentity: async () => WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    resolveReviewerIdentity: async () => WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
    resolvePublicIdentity: async () => ({
      identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
      displayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME
    }),
    hasCanonicalDependency: async () => true,
    hasCanonicalLicense: async () => true,
    hasCommunityPost: async () => true,
    makeId: () => generatedIds.shift(),
    now: () => new Date(Date.UTC(2026, 7, 9, 12, 0, instant++)).toISOString()
  });
  await bootstrapOfficialWorkflows({
    candidate,
    manifest: boundManifest,
    publisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    reviewerIdentityId: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
    validation: {
      verifyCatalogSnapshot: async () => true,
      hasCanonicalDependency: async () => true,
      hasCommunityPost: async () => true
    }
  });
  return {
    database: commonDatabase({
      eventHead: 9,
      publisherExact: 1,
      officialSourceMarkerDiscussions: 3,
      events: events.map((event) => ({
        sequence: event.sequence,
        operation: event.operation,
        actorIdentityId: event.actorIdentityId,
        eventData: {
          operation: event.operation,
          actorIdentityId: event.actorIdentityId,
          input: clone(event.input),
          at: event.at,
          generatedIds: clone(event.generatedIds)
        },
        timestampExact: true
      })),
      idempotency
    }),
    identityInspect: identityInspect(false),
    sourcePosts: sourceState(clone(SOURCE_ITEMS))
  };
}

test("existing state verifier keeps both empty baselines and admits only the exact retained 9/9/9 baseline", async () => {
  const verifier = require(existingStatePath);
  const enabledEmpty = await verifier.verifyExistingWorkflowState({
    database: commonDatabase(),
    identityInspect: identityInspect(true),
    sourcePosts: sourceState([])
  });
  const disabledEmpty = await verifier.verifyExistingWorkflowState({
    database: commonDatabase(),
    identityInspect: identityInspect(false),
    sourcePosts: sourceState([])
  });
  const retained = await retainedFixture();
  const retainedBefore = clone(retained);
  const retainedResult = await verifier.verifyExistingWorkflowState(retained);

  assert.equal(enabledEmpty.baseline, "legacy-enabled-online-empty");
  assert.equal(disabledEmpty.baseline, "rolled-back-disabled-empty");
  assert.deepEqual(retainedResult, {
    schema: "present",
    appendOnly: true,
    events: 9,
    idempotency: 9,
    eventHead: 9,
    reviewerExact: 1,
    reviewerForbiddenRelations: 0,
    publisherExact: 1,
    publisherForbiddenRelations: 0,
    sourcePostsExact: 3,
    officialWorkflows: 3,
    idempotentReplay: true,
    baseline: "disabled-retained-official-bootstrap"
  });
  assert.deepEqual(retained, retainedBefore, "readback must not mutate or append retained state");
});

test("retained baseline rejects partial, extra, actor, operation, key, reference, publisher, source, and flag drift", async () => {
  const { verifyExistingWorkflowState } = require(existingStatePath);
  const baseline = await retainedFixture();
  const mutations = [
    (value) => { value.database.events.pop(); },
    (value) => {
      const event = clone(value.database.events.at(-1));
      event.sequence = 10;
      value.database.events.push(event);
      value.database.eventHead = 10;
    },
    (value) => { value.database.events[0].operation = "submitDraft"; },
    (value) => { value.database.events[0].actorIdentityId = WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID; },
    (value) => { value.database.idempotency[0].keyHash = crypto.randomBytes(32).toString("hex"); },
    (value) => { value.database.events[1].eventData.input.workflowId = "44444444-4444-4444-8444-444444444444"; },
    (value) => { value.database.publisherExact = 0; },
    (value) => { value.database.publisherForbiddenRelations = 1; },
    (value) => { value.database.officialSourceMarkerDiscussions = 4; },
    (value) => { value.sourcePosts.items.pop(); value.sourcePosts.sourcePostCount = 2; },
    (value) => {
      value.sourcePosts.items.push({ key: "unknown", discussionId: "104", postId: "204" });
      value.sourcePosts.sourcePostCount = 4;
    },
    (value) => { value.identityInspect = identityInspect(true); }
  ];
  for (const mutate of mutations) {
    const value = clone(baseline);
    mutate(value);
    await assert.rejects(() => verifyExistingWorkflowState(value), /existing Workflow state/i);
  }
});

test("r12 makes retained verification mode explicit: disabled before activation and workflow-only after", async () => {
  const { verifyExistingWorkflowState } = require(existingStatePath);
  const disabled = await retainedFixture();
  const target = clone(disabled);
  target.identityInspect = identityInspectProfile(["0", "0", "1", "1", "0", "1"]);
  const legacy = clone(disabled);
  legacy.identityInspect = identityInspect(true);
  const emptyWorkflowOnly = {
    database: commonDatabase(),
    identityInspect: identityInspectProfile(["0", "0", "1", "1", "0", "1"]),
    sourcePosts: sourceState([])
  };

  assert.equal((await verifyExistingWorkflowState({ ...disabled, mode: "baseline" })).baseline, "disabled-retained-official-bootstrap");
  assert.equal((await verifyExistingWorkflowState({ ...target, mode: "target" })).baseline, "workflow-only-retained-official-bootstrap");
  await assert.rejects(() => verifyExistingWorkflowState({ ...disabled, mode: "target" }), /existing Workflow state/i);
  await assert.rejects(() => verifyExistingWorkflowState({ ...target, mode: "baseline" }), /existing Workflow state/i);
  await assert.rejects(() => verifyExistingWorkflowState({ ...legacy, mode: "target" }), /existing Workflow state/i);
  await assert.rejects(() => verifyExistingWorkflowState({ ...emptyWorkflowOnly, mode: "target" }), /existing Workflow state/i);
});

test("source-post readback program is fixed, manifest-controlled, read-only, and secret silent", () => {
  const { SOURCE_POST_READBACK_PROGRAM } = require(existingStatePath);
  assert.equal(typeof SOURCE_POST_READBACK_PROGRAM, "string");
  assert.match(SOURCE_POST_READBACK_PROGRAM, /workflow-official-source-posts-candidate\.json/);
  assert.match(SOURCE_POST_READBACK_PROGRAM, /readExistingOfficialSourcePosts/);
  assert.match(SOURCE_POST_READBACK_PROGRAM, /createLocalFlarumAdminRequest/);
  assert.doesNotMatch(SOURCE_POST_READBACK_PROGRAM, /\bfor\s*\(/);
  assert.doesNotMatch(SOURCE_POST_READBACK_PROGRAM, /\b(?:POST|DELETE|ensureOfficialSourcePosts)\b/);
  assert.doesNotMatch(SOURCE_POST_READBACK_PROGRAM, /console\.(?:log|error)|Authorization|apiKey:/);
});
