const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPublicContributionReadModel
} = require("../community/public-contributions.cjs");

function sourceSnapshot(overrides = {}) {
  return {
    revision: 1,
    at: "2026-08-01T00:00:00.000Z",
    actorIdentityId: "identity-submitter",
    canonicalSource: "https://source.example/workflows/reviewed",
    originalAuthorIdentityId: "identity-author",
    originalAuthor: "Original author",
    organization: "Original organization",
    licenseId: "CC-BY-4.0",
    evidenceRefs: ["https://source.example/evidence"],
    discoveredVia: "private discovery audit",
    workflowRef: {
      workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      version: 3
    },
    catalogReferences: [],
    hostTuples: [],
    ...overrides
  };
}

function acceptedWorkflow(overrides = {}) {
  return {
    submissionId: "workflow-main",
    revision: 2,
    status: "accepted",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded",
    submittedByIdentityId: "identity-submitter",
    submittedByDisplayName: "Old submitter name",
    contributors: ["identity-submitter", "identity-contributor"],
    publicEligibility: true,
    publicEligibilitySourceRevision: 1,
    sourceSnapshots: [sourceSnapshot()],
    proposal: {
      submissionKind: "workflow",
      title: "Publish a reviewed workflow",
      summary: "A data-only workflow listing.",
      originalAuthorIdentityId: "identity-author",
      originalAuthor: "Current proposal author",
      organization: "Current proposal organization",
      canonicalSource: "https://proposal.example/current",
      licenseId: "CURRENT-LICENSE",
      sourceRevision: "v1.0.0",
      ownershipClaim: "private claim",
      evidenceRefs: ["private evidence"],
      discoveredVia: "private discovery audit",
      workflowRef: {
        workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        version: 99
      }
    },
    audit: [
      { action: "created", at: "2026-08-01T00:00:00.000Z", revision: 1 },
      { action: "accept", at: "2026-08-02T00:00:00.000Z", revision: 2, note: "internal" }
    ],
    ...overrides
  };
}

function mergedContribution(overrides = {}) {
  return {
    submissionId: "workflow-merged",
    revision: 3,
    status: "merged",
    mergeIntoSubmissionId: "workflow-main",
    reviewStatus: "automated-reviewed",
    riskLevel: "low",
    submittedByIdentityId: "identity-contributor",
    submittedByDisplayName: "Contributor",
    contributors: ["identity-contributor"],
    sourceSnapshots: [
      sourceSnapshot({
        at: "2026-07-31T00:00:00.000Z",
        actorIdentityId: "identity-contributor",
        canonicalSource: "https://source.example/workflows/earlier",
        organization: null,
        workflowRef: {
          workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          version: 2
        }
      }),
      sourceSnapshot({
        revision: 2,
        at: "2026-08-01T12:00:00.000Z",
        actorIdentityId: "identity-contributor",
        canonicalSource: "https://source.example/workflows/earlier-v2",
        organization: null,
        workflowRef: {
          workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          version: 2
        }
      })
    ],
    proposal: {
      submissionKind: "workflow",
      title: "Earlier contribution",
      summary: "An earlier revision source.",
      originalAuthor: "Original author",
      canonicalSource: "https://source.example/workflows/earlier",
      licenseId: "CC-BY-4.0",
      sourceRevision: "v0.9.0",
      discoveredVia: "private discovery audit",
      workflowRef: {
        workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        version: 2
      }
    },
    audit: [
      { action: "created", at: "2026-07-31T00:00:00.000Z", revision: 1 },
      { action: "update", at: "2026-08-01T12:00:00.000Z", revision: 2, note: "private" },
      { action: "merge", at: "2026-08-02T01:00:00.000Z", revision: 3, note: "private" }
    ],
    ...overrides
  };
}

function model(isPubliclyAllowed = (record) => record.submissionId === "workflow-main") {
  return createPublicContributionReadModel({
    isPubliclyAllowed,
    resolvePublicIdentity(identityId, fallbackDisplayName) {
      return {
        identityId,
        displayName: identityId === "identity-submitter" ? "Renamed submitter" : fallbackDisplayName
      };
    }
  });
}

test("public contribution cards keep provenance and merged contributors without private fields", () => {
  const readModel = model().build([acceptedWorkflow(), mergedContribution()]);
  const card = readModel.get("workflow-main");

  assert.equal(readModel.list().length, 1);
  assert.equal(readModel.get("workflow-merged"), null, "merged source is never an independent public card");
  assert.deepEqual(card.submittedBy, {
    identityId: "identity-submitter",
    displayName: "Renamed submitter"
  });
  assert.equal(card.originalAuthor.displayName, "Original author");
  assert.equal(card.originalAuthor.organization, "Original organization");
  assert.equal(card.canonicalSource, "https://source.example/workflows/reviewed");
  assert.equal(card.licenseId, "CC-BY-4.0");
  assert.deepEqual(card.sourceRevisionRef, { submissionId: "workflow-main", revision: 1 });
  assert.deepEqual(card.workflow, {
    workflowId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    version: 3
  });
  assert.deepEqual(
    card.contributions.map((entry) => entry.submissionId).sort(),
    ["workflow-main", "workflow-merged"]
  );
  assert.deepEqual(
    card.actions.map((entry) => entry.kind),
    ["claim-original-authorship", "propose-correction", "propose-evidence", "report"]
  );
  assert.equal(JSON.stringify(card).includes("private"), false);
  assert.equal(JSON.stringify(card).includes("discoveredVia"), false);
  assert.equal(JSON.stringify(card).includes("execute"), false);
  assert.equal(Object.isFrozen(card), true);

  assert.deepEqual(
    readModel.history("workflow-main").entries.map((entry) => [entry.sourceRevisionRef.submissionId, entry.sourceRevisionRef.revision, entry.canonicalSource]),
    [
      ["workflow-merged", 1, "https://source.example/workflows/earlier"],
      ["workflow-main", 1, "https://source.example/workflows/reviewed"],
      ["workflow-merged", 2, "https://source.example/workflows/earlier-v2"]
    ]
  );
  assert.equal(JSON.stringify(readModel.history("workflow-main")).includes("evidence"), false);
  assert.equal(readModel.profile("identity-contributor").statusSummary.accepted, 1);
});

test("public read model fails closed for non-public, unsafe, incomplete, and incomplete-merge records", () => {
  const records = [
    acceptedWorkflow({ submissionId: "not-public" }),
    acceptedWorkflow({ submissionId: "canonical-not-public", publicEligibility: false }),
    acceptedWorkflow({
      submissionId: "unsafe",
      riskLevel: "unsafe",
      contributors: ["identity-submitter"],
      proposal: { ...acceptedWorkflow().proposal, workflowRef: undefined }
    }),
    acceptedWorkflow({
      submissionId: "missing-license",
      contributors: ["identity-submitter"],
      proposal: { ...acceptedWorkflow().proposal, licenseId: null, workflowRef: undefined }
    }),
    acceptedWorkflow({
      submissionId: "missing-merged-contributor",
      contributors: ["identity-submitter", "identity-missing"],
      proposal: { ...acceptedWorkflow().proposal, workflowRef: undefined }
    }),
    { ...mergedContribution(), mergeIntoSubmissionId: "missing-merged-contributor" },
    { ...acceptedWorkflow(), submissionId: "draft", status: "draft" },
    { ...acceptedWorkflow(), submissionId: "rejected", status: "rejected", reviewStatus: "rejected" }
  ];
  const readModel = model((record) => record.submissionId === "missing-merged-contributor").build(records);

  assert.equal(readModel.list().length, 0);
  assert.equal(readModel.profile("identity-submitter").statusSummary.accepted, 0);
});

test("a temporary eligibility hold hides a listing without mutating its record or history", () => {
  const record = acceptedWorkflow();
  const hidden = model(() => false).build([record, mergedContribution()]);
  const restored = model((candidate) => candidate.submissionId === "workflow-main").build([
    record,
    mergedContribution()
  ]);

  assert.equal(hidden.get("workflow-main"), null);
  assert.equal(restored.get("workflow-main").contributions.length, 2);
  assert.equal(record.status, "accepted");
  assert.equal(record.audit.length, 2);
});

test("canonical public eligibility, tampered source revision references, and unsafe snapshot fields fail closed", () => {
  const invalidRef = acceptedWorkflow({ publicEligibilitySourceRevision: 2 });
  const records = [
    acceptedWorkflow({ submissionId: "canonical-public-eligibility-false", publicEligibility: false }),
    invalidRef,
    ...["command", "args", "env", "headers", "credentials", "script", "endpoint", "path", "secret", "unknown"].map((field) =>
      acceptedWorkflow({
        submissionId: `unsafe-snapshot-${field}`,
        sourceSnapshots: [sourceSnapshot({ [field]: "do-not-run" })]
      })
    )
  ];
  const modelWithAllAllowed = model(() => true).build(records);

  assert.equal(modelWithAllAllowed.list().length, 0);
});

test("legacy publicly eligible records without snapshots expose only unavailable revision history", () => {
  const legacy = acceptedWorkflow({ sourceSnapshots: [] });
  const readModel = model(() => true).build([legacy]);

  assert.equal(readModel.get("workflow-main"), null);
  assert.deepEqual(readModel.history("workflow-main"), {
    contributionId: "workflow-main",
    availability: { status: "unavailable", reason: "source-snapshots-missing-or-invalid" },
    entries: []
  });
});
