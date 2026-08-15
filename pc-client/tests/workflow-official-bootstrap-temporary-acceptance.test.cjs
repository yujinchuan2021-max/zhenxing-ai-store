"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  ACTIVE_ADMIN_IMAGE,
  EXPECTED_ADMIN_IMAGE_ID,
  IDENTITY_IMAGE,
  EXPECTED_IDENTITY_IMAGE_ID,
  EXPECTED_SOURCE_DIGEST,
  SOURCE_POST_KEYS,
  assertOfficialBootstrapDatabaseCounts,
  cleanupExactRunnerOwnedVolumes,
  validateOfficialBootstrapRunnerContract,
  assertSafeBootstrapReport
} = require("../deployment/community-production/workflow-official-bootstrap-temporary-acceptance.cjs");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("official full-stack runner freezes the active7/Admin/Identity/source-post contract", () => {
  const manifest = JSON.parse(read("deployment/community-production/manifest.json"));
  const bootstrap = JSON.parse(read("community/workflow-official-bootstrap-candidate.json"));
  const sourcePosts = JSON.parse(read("community/workflow-official-source-posts-candidate.json"));
  assert.equal(ACTIVE_ADMIN_IMAGE, "zhenxing-ai/admin:0.1.40-src-186ff057efd3");
  assert.equal(EXPECTED_ADMIN_IMAGE_ID, "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd");
  assert.equal(IDENTITY_IMAGE, "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8");
  assert.equal(EXPECTED_IDENTITY_IMAGE_ID, "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01");
  assert.equal(EXPECTED_SOURCE_DIGEST, "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8");
  assert.deepEqual(bootstrap.workflows.map((item) => item.sourcePostKey), SOURCE_POST_KEYS);
  assert.deepEqual(sourcePosts.posts.map((item) => item.key), SOURCE_POST_KEYS);
  const source = read("deployment/community-production/workflow-official-bootstrap-temporary-acceptance.cjs");
  assert.doesNotMatch(source, /INSERT INTO posts|INSERT INTO discussions/);
  assert.match(source, /name === "forum_api_key" \? `\$\{value\}\\n` : value/);
  assert.equal(validateOfficialBootstrapRunnerContract({ manifest, bootstrap, sourcePosts }), true);
});

test("bootstrap report is strictly allowlisted and redacted", () => {
  const report = assertSafeBootstrapReport({
    schema: "aihub-workflow-official-bootstrap-acceptance-v1",
    candidateOnly: true,
    deployable: false,
    status: "pass",
    manifestDigest: "a".repeat(64),
    identityImageId: EXPECTED_IDENTITY_IMAGE_ID,
    identitySourceDigest: EXPECTED_SOURCE_DIGEST,
    adminImageId: EXPECTED_ADMIN_IMAGE_ID,
    runnerSha256: "b".repeat(64),
    workflowCount: 3,
    sourcePostCount: 3,
    checks: { publicListCount: 3, publicDetails: true, caddyHealthy: true },
    cleanup: { completed: true, projectResourcesRemoved: true, privateFixtureRemoved: true }
  });
  assert.equal(report.workflowCount, 3);
  assert.throws(() => assertSafeBootstrapReport({ ...report, secret: "value" }), /report schema/);
});

test("official bootstrap requires independent append-only counts before replay and after unlist", () => {
  assert.equal(assertOfficialBootstrapDatabaseCounts({
    events: 9, idempotency: 9, eventHeadRows: 1, eventHead: 9
  }, 9), true);
  assert.throws(() => assertOfficialBootstrapDatabaseCounts({
    events: 9, idempotency: 8, eventHeadRows: 1, eventHead: 9
  }, 9), /database counts/);
  assert.throws(() => assertOfficialBootstrapDatabaseCounts({
    events: 9, idempotency: 9, eventHeadRows: 0, eventHead: 9
  }, 9), /database counts/);
  assert.throws(() => assertOfficialBootstrapDatabaseCounts({
    events: 9, idempotency: 9, eventHeadRows: 1, eventHead: 8
  }, 9), /database counts/);

  const source = read("deployment/community-production/workflow-official-bootstrap-temporary-acceptance.cjs");
  assert.match(source, /assertOfficialBootstrapDatabaseCounts\(firstCounts, 9\)/);
  assert.match(source, /const replay = runOfficialBootstrap\(\)/);
  assert.match(source, /assertOfficialBootstrapDatabaseCounts\(replayCounts, 9\)/);
  assert.match(source, /assertOfficialBootstrapDatabaseCounts\(unlistCounts, 12\)/);
  assert.doesNotMatch(source, /idempotencyEventCount/);
});

test("official bootstrap cleanup fails closed when an exact runner-owned volume survives or cannot be removed", () => {
  const volumes = ["workflowacceptancefixture_caddy_data", "workflowacceptancefixture_caddy_config", "workflowacceptancefixture_caddy_secret"];
  const surviving = new Set([volumes[1]]);
  const calls = [];
  const docker = (args) => {
    calls.push(args);
    if (args[1] === "rm" && args.at(-1) === volumes[1]) throw new Error("remove denied");
    if (args[1] === "ls") return `${[...surviving].join("\n")}\n`;
    return "";
  };
  assert.equal(cleanupExactRunnerOwnedVolumes(volumes, docker), false);
  assert.equal(calls.filter((args) => args[1] === "rm").length, 3);
  assert.equal(calls.filter((args) => args[1] === "ls").length, 1);
  assert.equal(calls.filter((args) => args[1] === "rm").every((args) => volumes.includes(args.at(-1))), true);
});

test("official bootstrap cleanup fails closed when final volume enumeration cannot read the Docker control plane", () => {
  const volumes = ["workflowacceptancefixture_caddy_data", "workflowacceptancefixture_caddy_config", "workflowacceptancefixture_caddy_secret"];
  let enumerated = false;
  assert.equal(cleanupExactRunnerOwnedVolumes(volumes, (args) => {
    if (args[1] === "ls") { enumerated = true; throw new Error("daemon unavailable"); }
    return "";
  }), false);
  assert.equal(enumerated, true);
});
