"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
  workflowOfficialPublisherIdentityRecord
} = require("../identity/workflow-official-publisher-service-identity.cjs");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
} = require("../identity/workflow-reviewer-service-identity.cjs");

const root = path.resolve(__dirname, "..");

test("official Workflow publisher is one fixed disabled organization service identity", () => {
  assert.equal(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID, "46564566-f5f4-599c-8ce5-0609069f5148");
  assert.equal(WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME, "枕星 AI");
  assert.notEqual(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID, WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID);
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
  const source = fs.readFileSync(path.join(root, "identity", "workflow-official-publisher-service-identity.cjs"), "utf8");
  assert.doesNotMatch(source, /process\.env|publisherIdentityId|reviewerIdentityId|accessToken|bearer/i);
});

test("official publisher schema remains an explicit candidate with six relationship guards", () => {
  const runtimeSchema = fs.readFileSync(path.join(root, "identity", "schema.sql"), "utf8");
  const migration = fs.readFileSync(path.join(
    root, "identity", "migrations", "candidates", "0003-workflow-official-publisher-service-identity.sql"
  ), "utf8");
  const rollback = fs.readFileSync(path.join(
    root, "identity", "migrations", "candidates", "0003-workflow-official-publisher-service-identity.rollback.sql"
  ), "utf8");
  assert.doesNotMatch(runtimeSchema, /workflow-official-publisher-service/);
  assert.match(migration, /46564566-f5f4-599c-8ce5-0609069f5148/);
  for (const relation of [
    "community_profiles", "profile_avatars", "devices", "sessions",
    "community_handoffs", "email_change_challenges"
  ]) {
    assert.match(migration, new RegExp(relation));
  }
  assert.match(rollback, /official Workflow publisher identity must be absent before rollback/);
});
