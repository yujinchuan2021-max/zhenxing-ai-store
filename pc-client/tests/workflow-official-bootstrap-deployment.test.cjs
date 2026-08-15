"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createIdentitySourceManifest } = require("../deployment/community-production/identity-source-manifest.cjs");
const { createManifest, verifyManifest } = require("../deployment/community-production/verify-manifest.cjs");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("official Workflow bootstrap deployment is explicit, disabled by default, and source-closed", () => {
  const overlay = read("deployment/community-production/compose.workflow-production.yaml");
  const entrypoint = read("deployment/community-production/identity-entrypoint.sh");
  const dockerfile = read("deployment/community-production/identity.Dockerfile");
  assert.match(overlay, /workflow-official-bootstrap:/);
  assert.match(overlay, /profiles: \["workflow-official-bootstrap"\]/);
  assert.match(overlay, /AIHUB_WORKFLOW_OFFICIAL_BOOTSTRAP_MODE: run/);
  assert.match(overlay, /network_mode: "service:community"/);
  assert.match(entrypoint, /AIHUB_WORKFLOW_OFFICIAL_BOOTSTRAP_MODE/);
  assert.match(entrypoint, /exec node \/app\/identity\/workflow-official-bootstrap-production\.cjs/);
  assert.match(dockerfile, /community\/workflow-official-bootstrap\.cjs/);
  assert.match(dockerfile, /community\/workflow-official-source-posts\.cjs/);
  assert.equal(overlay.includes("TO_BE_FROZEN"), false);
  assert.equal(overlay.includes("AIHUB_WORKFLOW_OFFICIAL_BOOTSTRAP_ENABLED: \"1\""), false);

  const source = createIdentitySourceManifest();
  assert.equal(source.digest.sha256, "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7");
  assert.equal(source.files.length, 74);
  for (const relative of [
    "community/workflow-official-bootstrap.cjs",
    "community/workflow-official-source-posts.cjs",
    "identity/workflow-official-bootstrap-production.cjs"
  ]) assert.equal(source.files.some((entry) => entry.path === relative), true);
});

test("deployment manifest is regenerated from the frozen file set", () => {
  assert.equal(verifyManifest(), true);
  const manifest = createManifest();
  assert.equal(manifest.files.some((entry) => entry.path.endsWith("compose.workflow-production.yaml")), true);
});
