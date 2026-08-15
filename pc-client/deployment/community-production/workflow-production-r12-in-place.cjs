"use strict";

const R12 = Object.freeze({
  runId: "workflow-production-r12",
  projectName: "zhenxing-community-production",
  services: Object.freeze([
    "admin",
    "identity-database",
    "identity",
    "community-database",
    "community",
    "caddy"
  ]),
  recreateServices: Object.freeze(["admin", "identity"]),
  oneShots: Object.freeze([
    "workflow-migrate:verify",
    "workflow-reviewer-provision:verify",
    "workflow-official-bootstrap:verify"
  ]),
  active6: Object.freeze({
    stateSha256: "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9",
    releaseId: "catalog-v00000006-567e671621f1-3dcee587",
    releaseSha256: "c1ea9b76d1e134be1e565cf5018a77013a2387fe59452f3ebdc1f0e96f49e139"
  }),
  active7: Object.freeze({
    stateSha256: "cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012",
    releaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    releaseSha256: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4"
  }),
  v1: Object.freeze({
    releaseId: "catalog-v00000072-e286516335da-a8b62a49",
    catalogVersion: 72,
    releaseSha256: "1321cf4507ed601fc201ed13a7ceadb9b542b51375e9f7ac6b7099d2f280b6b8",
    catalogSha256: "e286516335da9272ce42902008c5f9016fdc444a42d988de2b22d8550a73f5ff"
  }),
  retained: Object.freeze({ sourcePosts: 3, events: 9, idempotency: 9, eventHead: 9 }),
  preservedDataRoles: Object.freeze([
    "admin-data",
    "admin-published",
    "admin-output",
    "identity-database",
    "community-database",
    "flarum-config",
    "flarum-storage",
    "flarum-assets",
    "secrets",
    "caddy-volumes",
    "backups-evidence"
  ])
});

function fail() {
  throw new Error("r12 in-place preflight is invalid");
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) fail();
  return value;
}

function verifyBaseline(value) {
  exactObject(value, [
    "projectName", "concurrentRuns", "services", "flags", "activeCatalog",
    "workflowReceipt", "resourceSubmissionTables", "preservedDataRoles"
  ]);
  if (value.projectName !== R12.projectName || value.concurrentRuns !== 0 ||
      !Array.isArray(value.services) || value.services.length !== R12.services.length ||
      !same(value.services.map((service) => service?.name), R12.services) ||
      value.services.some((service) => service?.health !== "healthy")) fail();
  exactObject(value.flags, ["profile"]);
  if (value.flags.profile !== "disabled") fail();
  exactObject(value.activeCatalog, ["stateSha256", "releaseId", "releaseSha256", "v1ReleaseId", "v1CatalogVersion", "v1ReleaseSha256", "v1CatalogSha256"]);
  if (value.activeCatalog.stateSha256 !== R12.active6.stateSha256 ||
      value.activeCatalog.releaseId !== R12.active6.releaseId ||
      value.activeCatalog.releaseSha256 !== R12.active6.releaseSha256 ||
      value.activeCatalog.v1ReleaseId !== R12.v1.releaseId ||
      value.activeCatalog.v1CatalogVersion !== R12.v1.catalogVersion ||
      value.activeCatalog.v1ReleaseSha256 !== R12.v1.releaseSha256 ||
      value.activeCatalog.v1CatalogSha256 !== R12.v1.catalogSha256) fail();
  verifyWorkflowReceipt(value.workflowReceipt, "disabled-retained-official-bootstrap");
  if (!Array.isArray(value.resourceSubmissionTables) ||
      value.resourceSubmissionTables.length !== 0 || !same(value.preservedDataRoles, R12.preservedDataRoles)) fail();
}

function verifyTarget(value) {
  exactObject(value, [
    "projectName", "concurrentRuns", "services", "flags", "activeCatalog",
    "workflowReceipt", "resourceSubmissionTables", "preservedDataRoles",
    "publicWorkflowCount", "bootstrapReplayZero"
  ]);
  if (value.projectName !== R12.projectName || value.concurrentRuns !== 0 ||
      !Array.isArray(value.services) || value.services.length !== R12.services.length ||
      !same(value.services.map((service) => service?.name), R12.services) ||
      value.services.some((service) => service?.health !== "healthy")) fail();
  exactObject(value.flags, ["profile"]);
  if (value.flags.profile !== "workflow-only") fail();
  exactObject(value.activeCatalog, ["stateSha256", "releaseId", "releaseSha256", "v1ReleaseId", "v1CatalogVersion", "v1ReleaseSha256", "v1CatalogSha256"]);
  if (value.activeCatalog.stateSha256 !== R12.active7.stateSha256 ||
      value.activeCatalog.releaseId !== R12.active7.releaseId ||
      value.activeCatalog.releaseSha256 !== R12.active7.releaseSha256 ||
      value.activeCatalog.v1ReleaseId !== R12.v1.releaseId ||
      value.activeCatalog.v1CatalogVersion !== R12.v1.catalogVersion ||
      value.activeCatalog.v1ReleaseSha256 !== R12.v1.releaseSha256 ||
      value.activeCatalog.v1CatalogSha256 !== R12.v1.catalogSha256) fail();
  verifyWorkflowReceipt(value.workflowReceipt, "workflow-only-retained-official-bootstrap");
  if (!Array.isArray(value.resourceSubmissionTables) || value.resourceSubmissionTables.length !== 0 ||
      !same(value.preservedDataRoles, R12.preservedDataRoles) || value.publicWorkflowCount !== 3 ||
      value.bootstrapReplayZero !== true) fail();
}

function verifyWorkflowReceipt(value, baseline) {
  exactObject(value, [
    "schema", "appendOnly", "events", "idempotency", "eventHead", "reviewerExact",
    "reviewerForbiddenRelations", "publisherExact", "publisherForbiddenRelations",
    "sourcePostsExact", "officialWorkflows", "idempotentReplay", "baseline"
  ]);
  if (value.schema !== "present" || value.appendOnly !== true ||
      value.events !== 9 || value.idempotency !== 9 || value.eventHead !== 9 ||
      value.reviewerExact !== 1 || value.reviewerForbiddenRelations !== 0 ||
      value.publisherExact !== 1 || value.publisherForbiddenRelations !== 0 ||
      value.sourcePostsExact !== 3 || value.officialWorkflows !== 3 ||
      value.idempotentReplay !== true || value.baseline !== baseline) fail();
}

function createR12InPlacePlan(baseline) {
  verifyBaseline(baseline);
  return Object.freeze({
    runId: R12.runId,
    projectName: R12.projectName,
    projectCount: 1,
    longRunningServices: [...R12.services],
    maximumOneShotServices: 1,
    recreateServices: [...R12.recreateServices],
    oneShots: [...R12.oneShots],
    initialProfile: "disabled",
    targetProfile: "workflow-only",
    targetActiveReleaseId: R12.active7.releaseId,
    resourceSubmissionTables: "absent",
    retained: { ...R12.retained },
    rollbackProfile: "disabled",
    rollbackActiveReleaseId: R12.active6.releaseId,
    preservesDataRoles: [...R12.preservedDataRoles]
  });
}

module.exports = { R12, createR12InPlacePlan, verifyWorkflowReceipt, verifyTarget };
