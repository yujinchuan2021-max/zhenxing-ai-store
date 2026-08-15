"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createAsyncWorkflowReleaseValidator,
  createResourceSubmissionAdminReviewSeam,
  createResourceSubmissionHttpSeam,
  createResourceSubmissionStore,
  normalizeResourceSubmission
} = require("../admin/resource-submissions.cjs");

const ACTOR = { identityId: "user-1", displayName: "User" };
const SUBMISSION = {
  submissionKind: "mcp",
  title: "One",
  summary: "Summary",
  canonicalSource: "https://example.com/source",
  scenarioTags: ["游戏开发"],
  evidenceRefs: ["https://example.com/evidence"]
};

test("sync workflow validation rejects a Promise instead of treating it as approval", () => {
  assert.throws(
    () => normalizeResourceSubmission({
      ...SUBMISSION,
      submissionKind: "workflow",
      workflowRef: { workflowId: "workflow-1", version: 1 }
    }, { hasWorkflowRelease: async () => false }),
    /workflow reference invalid/
  );
});

test("async workflow validation awaits the exact published release lookup", async () => {
  let received;
  const validate = createAsyncWorkflowReleaseValidator({
    lookupPublishedRelease: async (reference) => {
      received = reference;
      return true;
    }
  });
  const proposal = await validate({
    ...SUBMISSION,
    submissionKind: "workflow",
    workflowRef: { workflowId: "workflow-1", version: 1 }
  });
  assert.deepEqual(received, { workflowId: "workflow-1", version: 1 });
  assert.deepEqual(proposal.workflowRef, received);
});

test("async workflow validation fails closed for false, undefined, errors, and timeout", async () => {
  const workflow = {
    ...SUBMISSION,
    submissionKind: "workflow",
    workflowRef: { workflowId: "workflow-1", version: 1 }
  };
  for (const lookupPublishedRelease of [
    async () => false,
    async () => undefined,
    async () => ({ published: true, publiclyVisible: true }),
    async () => { throw new Error("database unavailable"); },
    () => new Promise(() => {})
  ]) {
    const validate = createAsyncWorkflowReleaseValidator({
      lookupPublishedRelease,
      timeoutMs: 5
    });
    await assert.rejects(() => validate(workflow), /workflow reference invalid/);
  }
});

test("non-workflow validation never calls the workflow lookup", async () => {
  let calls = 0;
  const validate = createAsyncWorkflowReleaseValidator({
    lookupPublishedRelease: async () => {
      calls += 1;
      return true;
    }
  });
  assert.deepEqual(await validate(SUBMISSION), normalizeResourceSubmission(SUBMISSION));
  assert.equal(calls, 0);
});

test("keeps one state machine and only emits a candidate after trusted review", () => {
  const store = createResourceSubmissionStore();
  const draft = store.create({
    actor: ACTOR,
    idempotencyKey: "one",
    submission: SUBMISSION
  });
  assert.equal(draft.status, "draft");
  assert.equal(draft.proposal.scenarioTags[0], "game-development");
  const submitted = store.mutateOwner({
    actorId: ACTOR.identityId,
    submissionId: draft.submissionId,
    expectedRevision: 1,
    action: "submit"
  });
  const accepted = store.review({
    reviewerIdentityId: "reviewer-1",
    submissionId: draft.submissionId,
    expectedRevision: 2,
    action: "accept",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded"
  });
  assert.equal(store.catalogMergeCandidate(accepted.submissionId).candidateOnly, true);
  assert.equal(accepted.submittedByIdentityId, ACTOR.identityId);
  assert.equal(accepted.reviewedBy, "reviewer-1");
  assert.equal(submitted.revision, 2);
});

test("rejects execution fields, stale writes, unsafe acceptance and self review", () => {
  const store = createResourceSubmissionStore();
  assert.throws(() =>
    store.create({
      actor: ACTOR,
      idempotencyKey: "bad",
      submission: { ...SUBMISSION, command: "x" }
    })
  );
  assert.throws(() =>
    store.create({
      actor: ACTOR,
      idempotencyKey: "bad-host",
      submission: { ...SUBMISSION, hostTuples: ["C:\\run.cmd"] }
    })
  );
  const draft = store.create({
    actor: ACTOR,
    idempotencyKey: "two",
    submission: SUBMISSION
  });
  assert.throws(
    () =>
      store.mutateOwner({
        actorId: ACTOR.identityId,
        submissionId: draft.submissionId,
        expectedRevision: 2,
        action: "submit"
      }),
    /revision conflict/
  );
  store.mutateOwner({
    actorId: ACTOR.identityId,
    submissionId: draft.submissionId,
    expectedRevision: 1,
    action: "submit"
  });
  assert.throws(
    () =>
      store.review({
        reviewerIdentityId: ACTOR.identityId,
        submissionId: draft.submissionId,
        expectedRevision: 2,
        action: "reject",
        riskLevel: "unsafe"
      }),
    /self review/
  );
  assert.throws(() =>
    store.review({
      reviewerIdentityId: "reviewer",
      submissionId: draft.submissionId,
      expectedRevision: 2,
      action: "accept",
      reviewStatus: "manually-reviewed",
      riskLevel: "unsafe"
    })
  );
});

test("idempotency binds a key to one normalized request", () => {
  const store = createResourceSubmissionStore();
  const first = store.create({
    actor: ACTOR,
    idempotencyKey: "same",
    submission: SUBMISSION
  });
  const replay = store.create({
    actor: ACTOR,
    idempotencyKey: "same",
    submission: SUBMISSION
  });
  assert.equal(replay.submissionId, first.submissionId);
  assert.throws(
    () =>
      store.create({
        actor: ACTOR,
        idempotencyKey: "same",
        submission: { ...SUBMISSION, title: "Different" }
      }),
    /idempotency conflict/
  );
});

test("exact dedupe merge preserves immutable contributor identities", () => {
  const store = createResourceSubmissionStore();
  const proposed = {
    ...SUBMISSION,
    originalAuthorIdentityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    catalogReferences: [
      { kind: "resource", canonicalId: "docs", hostProductId: "codex" }
    ],
    ownershipClaim: {
      kind: "author",
      evidenceRefs: ["https://example.com/author"]
    }
  };
  const first = store.create({
    actor: ACTOR,
    idempotencyKey: "three",
    submission: proposed
  });
  const second = store.create({
    actor: { identityId: "user-2", displayName: "Two" },
    idempotencyKey: "four",
    submission: proposed
  });
  assert.deepEqual(second.possibleDuplicateSubmissionIds, [first.submissionId]);
  assert.equal(
    store.findDuplicates({
      reviewerIdentityId: "reviewer",
      submissionId: first.submissionId
    })[0].submissionId,
    second.submissionId
  );
  const merged = store.review({
    reviewerIdentityId: "reviewer",
    submissionId: second.submissionId,
    expectedRevision: 1,
    action: "merge",
    mergeIntoSubmissionId: first.submissionId
  });
  assert.equal(merged.status, "merged");
  assert.deepEqual(
    store.get(first.submissionId, ACTOR.identityId).contributors,
    [ACTOR.identityId, "user-2"]
  );
});

test("HTTP seam exposes capability but cannot silently enable candidate writes", async () => {
  const seam = createResourceSubmissionHttpSeam({
    store: createResourceSubmissionStore(),
    resolveIdentity: () => ACTOR
  });
  assert.equal(seam.capability().enabled, false);
  await assert.rejects(
    () =>
      seam.create({
        headers: { "idempotency-key": "x" },
        body: SUBMISSION
      }),
    (error) => error.status === 503
  );
});

test("immutable source snapshots and reviewer-only public eligibility gate a candidate", async () => {
  const store = createResourceSubmissionStore({ enabled: true });
  const draft = store.create({ actor: ACTOR, idempotencyKey: "public", submission: { ...SUBMISSION, licenseId: "MIT" } });
  const submitted = store.mutateOwner({ actorId: ACTOR.identityId, submissionId: draft.submissionId, expectedRevision: 1, action: "submit" });
  const evidenced = store.mutateOwner({ actorId: ACTOR.identityId, submissionId: draft.submissionId, expectedRevision: submitted.revision, action: "evidence", evidenceRefs: ["https://example.com/later-evidence"] });
  const accepted = store.review({ reviewerIdentityId: "reviewer-1", submissionId: draft.submissionId, expectedRevision: evidenced.revision, action: "accept", reviewStatus: "manually-reviewed", riskLevel: "low" });
  assert.equal(accepted.publicEligibility, false);
  assert.deepEqual(accepted.sourceSnapshots.map((entry) => entry.revision), [1, 3]);
  assert.deepEqual(store.catalogMergeCandidate(accepted.submissionId).sourceRevisionRef, { submissionId: accepted.submissionId, revision: 3 });
  assert.throws(() => store.mutateOwner({ actorId: ACTOR.identityId, submissionId: draft.submissionId, expectedRevision: accepted.revision, action: "set-public-eligibility", publicEligibility: true }), /access denied/);
  assert.equal(store.review({ reviewerIdentityId: "reviewer-1", submissionId: draft.submissionId, expectedRevision: accepted.revision, action: "set-public-eligibility", publicEligibility: true }).publicEligibility, true);
  const seam = createResourceSubmissionAdminReviewSeam({ reviewAdapter: { review: async () => ({}) } });
  await assert.rejects(() => seam.review({ body: {} }), (error) => error.status === 503);
});
