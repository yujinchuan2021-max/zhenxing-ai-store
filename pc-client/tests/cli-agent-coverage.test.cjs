"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { CLI_DRIVER_IDS } = require("../shared/cli-driver-registry.cjs");
const {
  DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS,
  DRAFT89_CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");
const { buildCoverage } = require("../scripts/validate-cli-agent-coverage.cjs");

test("draft 89 CLI and Agent matrix has a fixed local lifecycle or an explicit blocker", () => {
  const coverage = buildCoverage({ expectedRevision: 89 });
  assert.deepEqual(coverage.summary, {
    "managed-ready": 32,
    "managed-partial": 2,
    "deploy-only": 1,
    "official-blocked": 13
  });
  assert.equal(coverage.rows.length, 48);
  assert.deepEqual(
    coverage.rows.filter((row) => row.status === "official-blocked").map((row) => row.productId).sort(),
    Object.keys(DRAFT89_CLI_REVIEW_BLOCKERS).sort()
  );
  for (const row of coverage.rows.filter((row) => row.status === "managed-ready")) {
    assert.ok(CLI_DRIVER_IDS.includes(row.driver), row.productId);
    assert.deepEqual(row.phases, ["environment-check", "deploy", "recheck", "open-terminal", "receipt-owned-uninstall"]);
  }
  const auggie = coverage.rows.find((row) => row.productId === "augment-auggie-cli");
  assert.deepEqual(auggie.excludedProfileCapabilities, ["repair"]);
  assert.equal(auggie.status, "managed-partial");
  assert.equal(auggie.capabilities.includes("repair"), false);
  assert.deepEqual(
    Object.keys(DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS),
    ["augment-auggie-cli"]
  );
});

test("the Electron driver registry wires every fixed driver used by the matrix", () => {
  const coverage = buildCoverage({ expectedRevision: 89 });
  const source = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
  for (const driver of new Set(coverage.rows.map((row) => row.driver).filter(Boolean))) {
    assert.match(source, new RegExp(`(?:[\\"']${driver}[\\"']|${driver}):\\s*\\{`), driver);
  }
  assert.match(source, /const CLI_INSTALL_PLANS = Object\.freeze\(\{ \.\.\.cliInstallPlans\(\), \.\.\.cliDeployOnlyPlans\(\) \}\)/);
});

test("draft 89 rejects an excluded local profile capability if the catalog starts claiming it", () => {
  const state = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../admin/published/catalog-store/state.json"), "utf8"));
  const product = state.draft.catalog.vendors
    .flatMap((vendor) => vendor.products || [])
    .find((entry) => entry.id === "augment-auggie-cli");
  assert.ok(product);
  product.capabilities = [...product.capabilities, "repair"];

  assert.throws(
    () => buildCoverage({ state, expectedRevision: 89 }),
    /augment-auggie-cli must not claim excluded profile capability repair/
  );
});
