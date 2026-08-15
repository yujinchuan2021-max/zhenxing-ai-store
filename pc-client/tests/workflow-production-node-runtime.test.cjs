"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const read = (name) => fs.readFileSync(path.join(deployment, name), "utf8");
const bash = "C:\\Program Files\\Git\\bin\\bash.exe";

test("production cutover uses one fixed release-scoped Node runtime before any host JavaScript", () => {
  const helper = read("workflow-node-runtime.sh");
  const cutover = read("workflow-production-cutover.sh");

  assert.match(helper, /NODE_VERSION='v24\.18\.1'/);
  assert.match(helper, /NODE_ARCHIVE_SHA256='9f5eb6ac21845a66c493c91a253b1da32fd684e89e9b7202d4936982336be4ca'/);
  assert.match(helper, /NODE_BINARY_SHA256='f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a'/);
  assert.match(helper, /linux-x64/);
  assert.doesNotMatch(helper, /latest|curl|wget|https?:\/\/|NODE_RUNTIME_(?:URL|VERSION|PATH)/);
  assert.match(helper, /AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE/);
  assert.match(helper, /Workflow Node acceptance override is forbidden in production/);

  assert.match(cutover, /source "\$script_dir\/workflow-node-runtime\.sh"/);
  assert.match(cutover, /preflight_workflow_node_runtime/);
  assert.match(cutover, /workflow_node="\$\(prepare_workflow_node_runtime\)"/);
  assert.ok(cutover.indexOf("preflight_workflow_node_runtime") < cutover.indexOf("backup.sh"));
  assert.ok(cutover.indexOf("prepare_workflow_node_runtime") < cutover.indexOf("backup.sh"));
  assert.doesNotMatch(cutover, /(^|[;&|()\s])node(?:\s|$)/m);
  assert.match(cutover, /"\$workflow_node" "\$script_dir\/verify-manifest\.cjs"/);
  assert.match(cutover, /"\$workflow_node" "\$script_dir\/identity-source-manifest\.cjs"/);
  assert.match(cutover, /"\$workflow_node" "\$script_dir\/workflow-production-temporary-acceptance\.cjs"/);
});

test("runtime archive and official checksum evidence are frozen in the deployment bundle", () => {
  const shasums = read("runtime/SHASUMS256.txt");
  const archive = path.join(deployment, "runtime", "node-v24.18.1-linux-x64.tar.gz");
  const metadata = JSON.parse(read("runtime/node-v24.18.1-linux-x64.json"));

  assert.match(shasums, /^9f5eb6ac21845a66c493c91a253b1da32fd684e89e9b7202d4936982336be4ca  node-v24\.18\.1-linux-x64\.tar\.gz$/m);
  assert.equal(fs.statSync(archive).size, 57254099);
  assert.deepEqual(Object.keys(metadata).sort(), [
    "architecture", "archive", "candidateOnly", "checksumsUrl", "executable",
    "minimumHost", "platform", "releaseLine", "schemaVersion", "sourceUrl", "version"
  ]);
  assert.equal(metadata.sourceUrl, "https://nodejs.org/download/release/v24.18.1/node-v24.18.1-linux-x64.tar.gz");
  assert.equal(metadata.checksumsUrl, "https://nodejs.org/download/release/v24.18.1/SHASUMS256.txt");
  assert.deepEqual(metadata.archive, {
    filename: "node-v24.18.1-linux-x64.tar.gz",
    bytes: 57254099,
    sha256: "9f5eb6ac21845a66c493c91a253b1da32fd684e89e9b7202d4936982336be4ca"
  });
});

test("production rejects a runtime override and isolated acceptance requires the complete double gate", () => {
  const helper = path.join(deployment, "workflow-node-runtime.sh");
  const run = (environment) => spawnSync(
    bash,
    ["-lc", 'source "$1"; workflow_node_acceptance_mode', "bash", helper],
    { encoding: "utf8", env: { ...process.env, ...environment } }
  );
  assert.equal(run({ AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH: "/tmp/node" }).status, 2);
  assert.equal(run({ AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE: "1" }).status, 2);
  assert.equal(run({ AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1" }).status, 2);
  assert.equal(run({
    AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
    AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE: "1",
    AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH: "/tmp/node"
  }).status, 0);
});

test("production runtime install and cutover share one fixed deployment owner", () => {
  const helper = read("workflow-node-runtime.sh");
  const cutover = read("workflow-production-cutover.sh");

  assert.match(helper, /WORKFLOW_NODE_DEPLOY_UID='1000'/);
  assert.match(helper, /WORKFLOW_NODE_DEPLOY_GID='1000'/);
  assert.match(helper, /workflow_node_deployment_owner\(\)/);
  assert.match(helper, /"\$\{SUDO_UID:-\}" == "\$WORKFLOW_NODE_DEPLOY_UID"/);
  assert.match(helper, /"\$\{SUDO_GID:-\}" == "\$WORKFLOW_NODE_DEPLOY_GID"/);
  assert.match(helper, /approved="\$\(workflow_node_deployment_owner\)"/);
  assert.match(helper, /install -d -m 0755 -o "\$owner_uid" -g "\$owner_gid"/);
  assert.match(helper, /chown "\$owner_uid:\$owner_gid" "\$workflow_node_temp"/);
  assert.match(helper, /find -P "\$workflow_node_temp" -depth -delete/);
  assert.doesNotMatch(cutover, /Workflow Node installed runtime metadata|stat[^\n]*\.workflow-runtime|chown[^\n]*\.workflow-runtime/);
});
