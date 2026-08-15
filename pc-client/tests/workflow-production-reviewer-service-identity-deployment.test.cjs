"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("production overlay pins one governed reviewer service identity and one Identity-only provision job", () => {
  const base = read("deployment/community-production/compose.server.yaml");
  const production = read("deployment/community-production/compose.workflow-production.yaml");
  const caddy = read("deployment/community-production/Caddyfile");

  assert.doesNotMatch(base, /WORKFLOW_REVIEWER_PROVISION|workflow_review_secret|5f16d5ac-6663-5905-b920-c2140ac6769c/);
  assert.match(production, /workflow-reviewer-provision:/);
  assert.match(production, /profiles: \["workflow-reviewer-provision"\]/);
  assert.match(production, /AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE: hold/);
  assert.match(production, /AIHUB_WORKFLOW_REVIEWER_ID: 5f16d5ac-6663-5905-b920-c2140ac6769c/);
  assert.doesNotMatch(production, /AIHUB_WORKFLOW_PRODUCTION_REVIEWER_ID|22222222-2222-4222-8222-222222222222/);
  assert.doesNotMatch(caddy, /workflow_review_secret|WORKFLOW_REVIEW_SECRET/);
});

test("cutover keeps the opaque rollback receipt in one held Node process", () => {
  const cutover = read("deployment/community-production/workflow-production-cutover.sh");
  const entrypoint = read("deployment/community-production/identity-entrypoint.sh");
  const provision = read("identity/workflow-reviewer-production-provision.cjs");

  assert.match(entrypoint, /AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE/);
  assert.match(entrypoint, /exec node \/app\/identity\/workflow-reviewer-production-provision\.cjs/);
  assert.match(cutover, /coproc REVIEWER_PROVISION/);
  assert.match(cutover, /run_reviewer_preflight/);
  assert.match(cutover, /start_reviewer_provision/);
  assert.match(cutover, /finish_reviewer_provision rollback/);
  assert.match(cutover, /finish_reviewer_provision commit/);
  assert.doesNotMatch(cutover, /run-workflow-production-migration\.sh.*apply/);
  assert.match(provision, /provisionWorkflowReviewerServiceIdentity/);
  assert.match(provision, /async function preflight/);
  assert.match(provision, /rollbackProvisionedWorkflowReviewerServiceIdentity/);
  assert.match(provision, /control === "commit"/);
  assert.match(provision, /control !== "rollback"/);
  assert.doesNotMatch(provision, /22222222-2222-4222-8222-222222222222/);
});

test("cutover verifies the post-bootstrap Caddy PID1 identity instead of Docker Config.User", () => {
  const cutover = read("deployment/community-production/workflow-production-cutover.sh");

  assert.match(cutover, /awk .*\^Uid:\|\^Gid:.*\/proc\/1\/status/);
  assert.match(cutover, /Caddy PID1 identity is not nobody/);
  assert.doesNotMatch(cutover, /docker exec[^\n]*'id -u'/);
});

test("production provision is data-only and does not expose an arbitrary identity or secret seam", () => {
  const provision = read("identity/workflow-reviewer-production-provision.cjs");
  const forbidden = ["child_process", "exec(", "spawn(", "fetch(", "http://", "https://", "process.argv", "console.log"];
  for (const token of forbidden) assert.equal(provision.includes(token), false, token);
  assert.match(provision, /secretFile !== "\/run\/secrets\/workflow_review_secret"/);
  assert.match(provision, /byte < 0x20 \|\| byte > 0x7e/);
  assert.match(provision, /WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED/);
});
