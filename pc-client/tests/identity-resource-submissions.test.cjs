"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createIdentityClient } = require("../electron/identity-client.cjs");
const {
  createFixedServiceReviewerAuthenticator,
  createIdentityResourceSubmissionStore,
  createResourceSubmissionOwnerAdapter,
  createResourceSubmissionReviewAdapter
} = require("../identity/resource-submissions.cjs");

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEWER = "review-service:admin-primary";
const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL = {
  submissionKind: "skill",
  title: "Candidate",
  summary: "Candidate summary",
  canonicalSource: "https://example.com/skill",
  evidenceRefs: ["https://example.com/evidence"]
};
const WORKFLOW_PROPOSAL = {
  ...PROPOSAL,
  submissionKind: "workflow",
  workflowRef: { workflowId: "workflow-1", version: 1 }
};

function canonicalRecord(overrides = {}) {
  return {
    submissionId: SUBMISSION_ID,
    revision: 4,
    status: "accepted",
    submittedByIdentityId: OWNER,
    submittedByDisplayName: "Owner",
    reviewedBy: REVIEWER,
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded",
    proposal: PROPOSAL,
    dedupeFingerprint: "internal",
    possibleDuplicateSubmissionIds: ["22222222-2222-4222-8222-222222222222"],
    contributors: [OWNER],
    mergeIntoSubmissionId: null,
    audit: [{ revision: 4, action: "accept", detail: "private" }],
    ...overrides
  };
}

function result(rows = []) {
  return { rowCount: rows.length, rows };
}

function scriptedPool(steps) {
  async function query(sql, params = []) {
    const step = steps.shift();
    assert.ok(step, `unexpected query: ${sql}`);
    assert.match(sql.replace(/\s+/g, " ").trim(), step.match);
    step.check?.(params);
    return step.result || result();
  }
  return {
    query,
    connect: async () => ({ query, release() {} }),
    assertDone() {
      assert.equal(steps.length, 0, `${steps.length} scripted queries remain`);
    }
  };
}

test("Identity persistence candidate is disabled by default and requires a limiter", async () => {
  const pool = scriptedPool([]);
  const store = createIdentityResourceSubmissionStore({ pool });
  assert.equal(store.capability().enabled, false);
  assert.deepEqual(store.capability().temporarilyUnavailableKinds, ["workflow"]);
  await assert.rejects(
    () =>
      store.create({
        actor: { identityId: OWNER, displayName: "Owner" },
        idempotencyKey: "one",
        submission: PROPOSAL
      }),
    (error) => error.status === 503
  );
  assert.throws(
    () => createIdentityResourceSubmissionStore({ pool, enabled: true }),
    /rateLimit/
  );
  pool.assertDone();
});

test("Identity workflow candidate awaits the published release lookup before database access", async () => {
  const pool = scriptedPool([]);
  let received;
  const store = createIdentityResourceSubmissionStore({
    pool,
    enabled: true,
    rateLimit: () => true,
    workflowSubmissionLookupEnabled: true,
    lookupPublishedWorkflowRelease: async (reference) => {
      received = reference;
      return false;
    }
  });
  await assert.rejects(
    () => store.create({
      actor: { identityId: OWNER, displayName: "Owner" },
      idempotencyKey: "workflow-create",
      submission: WORKFLOW_PROPOSAL
    }),
    /workflow reference invalid/
  );
  assert.deepEqual(received, { workflowId: "workflow-1", version: 1 });
  assert.deepEqual(store.capability().temporarilyUnavailableKinds, []);
  pool.assertDone();
});

test("review acceptance rechecks the exact workflow release and fails closed", async () => {
  const current = canonicalRecord({
    revision: 2,
    status: "submitted",
    proposal: WORKFLOW_PROPOSAL,
    reviewedBy: null,
    reviewStatus: "unreviewed",
    riskLevel: null
  });
  const pool = scriptedPool([
    { match: /^BEGIN$/ },
    {
      match: /FROM resource_submissions WHERE submission_id = ANY/,
      result: result([{ submission_id: SUBMISSION_ID, record: current }])
    },
    { match: /^ROLLBACK$/ }
  ]);
  let received;
  const store = createIdentityResourceSubmissionStore({
    pool,
    enabled: true,
    rateLimit: () => true,
    workflowSubmissionLookupEnabled: true,
    lookupPublishedWorkflowRelease: async (reference) => {
      received = reference;
      return false;
    }
  });
  await assert.rejects(
    () => store.review({
      reviewerIdentityId: REVIEWER,
      submissionId: SUBMISSION_ID,
      expectedRevision: 2,
      action: "accept",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }),
    /workflow reference invalid/
  );
  assert.deepEqual(received, { workflowId: "workflow-1", version: 1 });
  pool.assertDone();
});

test("workflow catalog candidate rechecks that the exact release remains public", async () => {
  const current = canonicalRecord({
    proposal: WORKFLOW_PROPOSAL,
    publicEligibility: true,
    publicEligibilitySourceRevision: 3,
    sourceSnapshots: [{
      revision: 3,
      canonicalSource: WORKFLOW_PROPOSAL.canonicalSource,
      licenseId: "MIT"
    }]
  });
  const pool = scriptedPool([{
    match: /SELECT record FROM resource_submissions WHERE submission_id/,
    result: result([{ record: current }])
  }]);
  let received;
  const store = createIdentityResourceSubmissionStore({
    pool,
    enabled: true,
    rateLimit: () => true,
    workflowSubmissionLookupEnabled: true,
    lookupPublishedWorkflowRelease: async (reference) => {
      received = reference;
      return false;
    }
  });
  await assert.rejects(
    () => store.catalogMergeCandidate({
      reviewerIdentityId: REVIEWER,
      submissionId: SUBMISSION_ID
    }),
    /workflow reference invalid/
  );
  assert.deepEqual(received, { workflowId: "workflow-1", version: 1 });
  pool.assertDone();
});

test("public eligibility cannot outlive the exact workflow release", async () => {
  const current = canonicalRecord({
    proposal: WORKFLOW_PROPOSAL,
    publicEligibility: false,
    publicEligibilitySourceRevision: null,
    sourceSnapshots: [{
      revision: 3,
      canonicalSource: WORKFLOW_PROPOSAL.canonicalSource,
      licenseId: "MIT"
    }]
  });
  const pool = scriptedPool([
    { match: /^BEGIN$/ },
    {
      match: /FROM resource_submissions WHERE submission_id = ANY/,
      result: result([{ submission_id: SUBMISSION_ID, record: current }])
    },
    { match: /^ROLLBACK$/ }
  ]);
  const store = createIdentityResourceSubmissionStore({
    pool,
    enabled: true,
    rateLimit: () => true,
    workflowSubmissionLookupEnabled: true,
    lookupPublishedWorkflowRelease: async () => false
  });
  await assert.rejects(
    () => store.review({
      reviewerIdentityId: REVIEWER,
      submissionId: SUBMISSION_ID,
      expectedRevision: 4,
      action: "set-public-eligibility",
      publicEligibility: true
    }),
    /workflow reference invalid/
  );
  pool.assertDone();
});

test("PostgreSQL adapter persists a normalized owner-scoped draft and audit", async () => {
  const pool = scriptedPool([
    { match: /^BEGIN$/ },
    { match: /^SELECT pg_advisory_xact_lock/ },
    { match: /FROM resource_submission_idempotency/, result: result() },
    { match: /FROM resource_submissions WHERE dedupe_fingerprint/, result: result() },
    {
      match: /INSERT INTO resource_submissions /,
      check(params) {
        assert.equal(params[0], SUBMISSION_ID);
        assert.equal(params[1], OWNER);
        assert.equal(JSON.parse(params[5]).submittedByDisplayName, "Current Name");
      }
    },
    { match: /INSERT INTO resource_submission_source_revisions/ },
    { match: /INSERT INTO resource_submission_idempotency/ },
    { match: /INSERT INTO resource_submission_audit/ },
    { match: /^COMMIT$/ }
  ]);
  const store = createIdentityResourceSubmissionStore({
    pool,
    enabled: true,
    rateLimit: () => true,
    makeId: () => SUBMISSION_ID,
    now: () => "2026-08-07T00:00:00.000Z"
  });
  const draft = await store.create({
    actor: { identityId: OWNER, displayName: "Current Name" },
    idempotencyKey: "create-once",
    submission: PROPOSAL
  });
  assert.equal(draft.submittedByIdentityId, OWNER);
  assert.equal(draft.status, "draft");
  assert.equal(typeof draft.dedupeFingerprint, "string");
  assert.equal(draft.publicEligibility, false);
  assert.deepEqual(draft.sourceSnapshots.map((entry) => entry.revision), [1]);
  pool.assertDone();
});

test("owner adapter emits a distinct allowlisted DTO and rejects reviewer fields", async () => {
  const calls = [];
  const accepted = canonicalRecord();
  const draft = canonicalRecord({ revision: 1, status: "draft" });
  let detail = accepted;
  const adapter = createResourceSubmissionOwnerAdapter({
    store: {
      capability: () => ({ enabled: true }),
      create: async (input) => (calls.push(["create", input]), draft),
      list: async (...input) => (
        calls.push(["list", ...input]),
        { items: [accepted], page: { offset: 0, limit: 20, nextOffset: null } }
      ),
      get: async (...input) => (calls.push(["get", ...input]), detail),
      mutateOwner: async (input) => (calls.push(["mutate", input]), draft)
    },
    resolveIdentity: async () => ({ identityId: OWNER, displayName: "Owner" })
  });
  const listed = await adapter.list({}, { offset: 0, limit: 20 });
  assert.equal(calls[0][1], OWNER);
  assert.deepEqual(Object.keys(listed.items[0]).sort(), [
    "allowedActions",
    "evidenceRequired",
    "expectedRevision",
    "proposal",
    "status",
    "submissionId"
  ]);
  assert.deepEqual(listed.items[0].allowedActions, []);
  for (const field of [
    "reviewedBy",
    "reviewStatus",
    "riskLevel",
    "contributors",
    "mergeIntoSubmissionId",
    "audit",
    "dedupeFingerprint",
    "possibleDuplicateSubmissionIds"
  ]) {
    assert.equal(field in listed.items[0], false, `${field} leaked to owner DTO`);
  }
  const created = await adapter.create({
    headers: { "idempotency-key": "one" },
    body: PROPOSAL
  });
  assert.deepEqual(created.allowedActions, ["update", "submit", "withdraw"]);
  detail = canonicalRecord({ status: "needs-evidence" });
  assert.deepEqual(
    (await adapter.get({}, SUBMISSION_ID)).allowedActions,
    ["evidence", "withdraw"]
  );
  await assert.rejects(
    () =>
      adapter.mutate(
        { body: { expectedRevision: 1, action: "submit", reviewerId: REVIEWER } },
        SUBMISSION_ID
      ),
    /fields invalid/
  );
});

test("review adapter derives reviewer identity from fixed service authentication", async () => {
  const secret = "s".repeat(32);
  let received;
  const adapter = createResourceSubmissionReviewAdapter({
    store: {
      review: async (input) => (received = input),
      findDuplicates: async () => [],
      catalogMergeCandidate: async () => ({ candidateOnly: true })
    },
    authenticateService: createFixedServiceReviewerAuthenticator({
      secret,
      reviewerIdentityId: REVIEWER
    })
  });
  await adapter.review({
    headers: { "x-aihub-resource-review-secret": secret },
    body: {
      submissionId: SUBMISSION_ID,
      expectedRevision: 1,
      action: "triage"
    }
  });
  assert.equal(received.reviewerIdentityId, REVIEWER);
  await adapter.review({
    headers: { "x-aihub-resource-review-secret": secret },
    body: {
      submissionId: SUBMISSION_ID,
      expectedRevision: 2,
      action: "set-public-eligibility",
      publicEligibility: true
    }
  });
  assert.equal(received.publicEligibility, true);
  await assert.rejects(
    () =>
      adapter.review({
        headers: { "x-aihub-resource-review-secret": secret },
        body: {
          submissionId: SUBMISSION_ID,
          expectedRevision: 1,
          action: "triage",
          reviewerId: "client-asserted"
        }
      }),
    /fields invalid/
  );
});

test("migration candidate is explicit, reversible and absent from runtime schema", () => {
  const identity = path.join(__dirname, "../identity");
  const apply = fs.readFileSync(
    path.join(identity, "migrations/candidates/0001-resource-submissions.sql"),
    "utf8"
  );
  const rollback = fs.readFileSync(
    path.join(
      identity,
      "migrations/candidates/0001-resource-submissions.rollback.sql"
    ),
    "utf8"
  );
  const runtimeSchema = fs.readFileSync(path.join(identity, "schema.sql"), "utf8");
  const migrationEntrypoint = fs.readFileSync(
    path.join(__dirname, "../deployment/community-production/run-migrations.sh"),
    "utf8"
  );
  assert.match(apply, /CREATE TABLE resource_submissions/);
  assert.match(apply, /resource_submission_idempotency/);
  assert.match(apply, /resource_submission_audit/);
  assert.match(apply, /resource_submission_source_revisions/);
  assert.match(apply, /resource_submission_abuse_reports/);
  assert.match(rollback, /DROP TABLE resource_submissions/);
  assert.match(rollback, /DROP TABLE resource_submission_source_revisions/);
  assert.doesNotMatch(runtimeSchema, /resource_submissions/);
  assert.doesNotMatch(migrationEntrypoint, /0001-resource-submissions/);
});

test("Identity client exposes the candidate seam only behind its main-process transport", async () => {
  const calls = [];
  let capabilityEnabled = false;
  const client = createIdentityClient({
    origin: "http://127.0.0.1:4180",
    deviceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    deviceName: "Test",
    vault: { read: () => null, write: () => {}, clear: () => {} },
    request: async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      calls.push({ pathname, options });
      if (pathname === "/v1/resource-submissions/capability") {
        return { enabled: capabilityEnabled };
      }
      if (pathname === "/v1/sessions/login") {
        return {
          user: {
            id: OWNER,
            profile: { nickname: "Owner", avatarUrl: "", bio: "" }
          },
          sessionId: "session",
          accessToken: "access-token",
          accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: "refresh-token",
          refreshExpiresAt: new Date(Date.now() + 120_000).toISOString()
        };
      }
      return { items: [] };
    }
  });
  assert.equal((await client.getResourceSubmissionCapability()).enabled, false);
  await client.login({ identifier: "owner", password: "password" });
  for (const disabledCall of [
    () => client.listMyResourceSubmissions({ offset: 0, limit: 10 }),
    () => client.getMyResourceSubmission(SUBMISSION_ID),
    () => client.createMyResourceSubmission("disabled", PROPOSAL),
    () =>
      client.mutateMyResourceSubmission(SUBMISSION_ID, {
        expectedRevision: 1,
        action: "submit"
      })
  ]) {
    await assert.rejects(
      disabledCall,
      (error) => error.status === 503 && error.code === "FEATURE_DISABLED"
    );
  }
  assert.equal(
    calls.some(
      (call) =>
        call.pathname.startsWith("/v1/me/resource-submissions")
    ),
    false,
    "disabled capability must stop before every owner request"
  );

  capabilityEnabled = true;
  await client.listMyResourceSubmissions({ offset: 20, limit: 10 });
  await client.getMyResourceSubmission(SUBMISSION_ID);
  await client.createMyResourceSubmission("idempotent", PROPOSAL);
  await client.mutateMyResourceSubmission(SUBMISSION_ID, {
    expectedRevision: 1,
    action: "submit"
  });
  const createCall = calls.find(
    (call) =>
      call.pathname === "/v1/me/resource-submissions" &&
      call.options.method === "POST"
  );
  assert.equal(createCall.options.idempotencyKey, "idempotent");

  const preload = fs.readFileSync(
    path.join(__dirname, "../electron/preload.cjs"),
    "utf8"
  );
  const main = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  const server = fs.readFileSync(path.join(__dirname, "../identity/server.cjs"), "utf8");
  assert.match(preload, /createSubmission:\s*\(input\)/);
  assert.match(main, /"Idempotency-Key": String\(options\.idempotencyKey\)/);
  assert.match(server, /AIHUB_RESOURCE_SUBMISSIONS_ENABLED === "1"/);
  assert.match(server, /AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION === "1"/);
  assert.doesNotMatch(server, /\/v1\/internal\/resource-submissions/);
});
