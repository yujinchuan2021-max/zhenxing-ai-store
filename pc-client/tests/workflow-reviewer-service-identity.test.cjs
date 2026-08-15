"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
  workflowReviewerServiceIdentityRecord
} = require("../identity/workflow-reviewer-service-identity.cjs");
const fs = require("node:fs");
const path = require("node:path");

test("Workflow reviewer service identity has one governed non-login record shape", () => {
  assert.equal(
    WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
    "5f16d5ac-6663-5905-b920-c2140ac6769c"
  );
  assert.deepEqual(workflowReviewerServiceIdentityRecord(), {
    id: "5f16d5ac-6663-5905-b920-c2140ac6769c",
    identityKind: "workflow-reviewer-service",
    status: "disabled",
    email: null,
    normalizedEmail: null,
    phone: null,
    normalizedPhone: null,
    passwordHash: null,
    username: "__workflow_reviewer_service__",
    normalizedUsername: "__workflow_reviewer_service__",
    communityUsername: "zx_5f16d5ac66635905b920c2140ac"
  });
});

test("reviewer identity remains an explicit candidate and is absent from runtime schema", () => {
  const root = path.resolve(__dirname, "..");
  const runtimeSchema = fs.readFileSync(path.join(root, "identity", "schema.sql"), "utf8");
  const candidate = fs.readFileSync(path.join(root, "identity", "migrations", "candidates", "0002-workflow-reviewer-service-identity.sql"), "utf8");
  assert.doesNotMatch(runtimeSchema, /workflow-reviewer-service/);
  assert.match(candidate, /identity_kind = 'workflow-reviewer-service'/);
  assert.match(candidate, /reject_workflow_reviewer_service_browser_relation/);
});
