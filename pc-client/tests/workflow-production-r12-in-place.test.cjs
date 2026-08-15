"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  R12,
  createR12InPlacePlan
} = require("../deployment/community-production/workflow-production-r12-in-place.cjs");

function baseline(overrides = {}) {
  return {
    projectName: R12.projectName,
    concurrentRuns: 0,
    services: R12.services.map((service) => ({ name: service, health: "healthy" })),
    flags: { profile: "disabled" },
    activeCatalog: {
      stateSha256: R12.active6.stateSha256,
      releaseId: R12.active6.releaseId,
      releaseSha256: R12.active6.releaseSha256,
      v1ReleaseId: R12.v1.releaseId,
      v1CatalogVersion: R12.v1.catalogVersion,
      v1ReleaseSha256: R12.v1.releaseSha256,
      v1CatalogSha256: R12.v1.catalogSha256
    },
    workflowReceipt: workflowReceipt(),
    resourceSubmissionTables: [],
    preservedDataRoles: [...R12.preservedDataRoles],
    ...overrides
  };
}

function workflowReceipt(overrides = {}) {
  return {
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
    baseline: "disabled-retained-official-bootstrap",
    ...overrides
  };
}

test("r12 creates exactly one in-place project plan from the disabled retained baseline", () => {
  const plan = createR12InPlacePlan(baseline());

  assert.deepEqual(plan, {
    runId: "workflow-production-r12",
    projectName: "zhenxing-community-production",
    projectCount: 1,
    longRunningServices: [...R12.services],
    maximumOneShotServices: 1,
    recreateServices: ["admin", "identity"],
    oneShots: ["workflow-migrate:verify", "workflow-reviewer-provision:verify", "workflow-official-bootstrap:verify"],
    initialProfile: "disabled",
    targetProfile: "workflow-only",
    targetActiveReleaseId: R12.active7.releaseId,
    resourceSubmissionTables: "absent",
    retained: { sourcePosts: 3, events: 9, idempotency: 9, eventHead: 9 },
    rollbackProfile: "disabled",
    rollbackActiveReleaseId: R12.active6.releaseId,
    preservesDataRoles: [...R12.preservedDataRoles]
  });
});

test("r12 rejects project, service, catalog, resource-table, concurrency, or retained-state drift before a plan exists", () => {
  const variants = [
    baseline({ projectName: "other-project" }),
    baseline({ concurrentRuns: 1 }),
    baseline({ services: baseline().services.slice(1) }),
    baseline({ activeCatalog: { ...baseline().activeCatalog, releaseSha256: "0".repeat(64) } }),
    baseline({ resourceSubmissionTables: ["resource_submissions"] }),
    baseline({ workflowReceipt: { events: 9, idempotency: 9, eventHead: 9 } })
  ];
  for (const input of variants) {
    assert.throws(() => createR12InPlacePlan(input), /r12 in-place preflight/i);
  }
});
