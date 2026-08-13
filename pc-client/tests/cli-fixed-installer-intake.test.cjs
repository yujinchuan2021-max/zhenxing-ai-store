"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { CLI_DRIVER_IDS } = require("../shared/cli-driver-registry.cjs");
const {
  cliInstallPlans,
  getInstallRegistration
} = require("../shared/install-registry.cjs");

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, relativePath), "utf8"));

const source = readJson(
  "../docs/research/windows-desktop-acquisition-deep-rescan-draft87-active4-2026-08-05.json"
);
const candidate = readJson("../docs/cli-fixed-installer-intake-candidate.json");

test("every deep-rescan fixed-script or package-manager candidate has one decision", () => {
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.sourceRevision, source.sourceRevision);
  assert.equal(candidate.sourceProductCount, source.sourceProductCount);

  const sourceIds = source.scriptPackageCandidates.map(({ productId }) => productId).sort();
  const decisionIds = candidate.decisions.map(({ productId }) => productId).sort();
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(new Set(decisionIds).size, decisionIds.length);
  assert.deepEqual(decisionIds, sourceIds);
});

test("the no-op candidate cannot become an executable backend binding", () => {
  assert.deepEqual(candidate.acceptedProfiles, []);
  assert.deepEqual(candidate.proposedBindings, []);
  assert.ok(candidate.decisions.every(({ classification }) =>
    ["blocked", "blocked-directory-identity", "out-of-scope-desktop"].includes(classification)
  ));

  const forbidden = new Set(candidate.intakeContract.backendForbiddenFields);
  for (const binding of candidate.proposedBindings) {
    for (const key of Object.keys(binding)) {
      assert.ok(!forbidden.has(key), `backend binding contains forbidden field ${key}`);
    }
  }
});

test("Hermes remains red until a fixed owned lifecycle is explicitly approved", () => {
  const hermes = candidate.decisions.find(({ productId }) => productId === "nous-hermes-agent");
  assert.equal(hermes?.classification, "blocked");
  assert.ok(hermes.reasonCodes.includes("nested-mutable-remote-bootstrap"));
  assert.equal(getInstallRegistration("nous-hermes-agent"), null);
  assert.equal(cliInstallPlans()["nous-hermes-agent"], undefined);
  assert.ok(!CLI_DRIVER_IDS.includes("managed-official-script"));
});

test("desktop product ids are never repurposed as managed CLI profiles", () => {
  for (const productId of ["raycast-windows", "gitkraken-desktop", "sunlogin-windows"]) {
    const registration = getInstallRegistration(productId);
    assert.notEqual(registration?.mode, "managed-cli", productId);
  }
});
