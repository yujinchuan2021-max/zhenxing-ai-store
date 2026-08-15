"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const adapterPath = path.join(root, "scripts", "workflow-current-identity-temporary-acceptance.cjs");

test("current Identity A-E uses one local adapter while production stays frozen", () => {
  assert.equal(fs.existsSync(adapterPath), true, "current Identity A-E adapter must exist");

  const adapter = require(adapterPath);
  const runner = require(path.join(root, "deployment", "community-production", "workflow-production-temporary-acceptance.cjs"));
  const evidence = path.join(root, "output", "workflow-current-identity-ae-test");

  assert.deepEqual(adapter.CURRENT_IDENTITY_CONTRACT, {
    image: "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8",
    imageId: "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01",
    sourceDigest: "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8"
  });
  assert.deepEqual(runner.PRODUCTION_IDENTITY_CONTRACT, {
    image: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e",
    imageId: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748",
    sourceDigest: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7"
  });
  assert.deepEqual(adapter.acceptanceArgumentsFor(evidence), [
    path.join(root, "deployment", "community-production", "compose.server.yaml"),
    path.join(root, "deployment", "community-production", "compose.workflow-production.yaml"),
    evidence
  ]);
  assert.equal(typeof runner.executeWithIdentityContract, "function");

  const source = fs.readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(source, /ssh|cutover|fresh-host|release-bundle|docker\s+(?:push|login)/i);
});
