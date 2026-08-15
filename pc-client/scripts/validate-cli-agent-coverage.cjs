"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CLI_DRIVER_IDS,
  CLI_DRIVER_OPERATIONS,
  driverIdForPlan
} = require("../shared/cli-driver-registry.cjs");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY,
  cliInstallPlans,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const {
  cliDeployOnlyPlans,
  publicCliDeployOnlyProfiles
} = require("../shared/cli-deploy-only.cjs");
const {
  DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS,
  DRAFT89_CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");

const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "admin", "published", "catalog-store", "state.json");
const ACTIVE6_REPORT_PATH = path.join(
  ROOT,
  "docs",
  "acceptance",
  "v2-active6-0.1.54-full-validation-2026-08-06-final.md"
);
const MANAGED_CAPABILITIES = ["website", "tutorial", "install", "open", "uninstall"];
const FULL_RECONCILE_DRIVERS = new Set([
  "npm",
  "portable-binary",
  "python-venv",
  "managed-msi"
]);

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function excludedProfileCapabilitiesFor(productId) {
  const decision = DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS[productId];
  return decision ? [...decision.capabilities] : [];
}

function subtractValues(values, excluded) {
  const excludedSet = new Set(excluded);
  return values.filter((value) => !excludedSet.has(value));
}

function productsFromDraft(draft) {
  return (draft.catalog?.vendors || []).flatMap((vendor) =>
    (vendor.products || []).map((product) => ({ ...product, vendorId: vendor.id }))
  );
}

function readState(statePath = STATE_PATH) {
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function buildCoverage({ state = readState(), expectedRevision } = {}) {
  const draft = state?.draft;
  assert.ok(draft?.catalog, "authoritative draft is missing");
  if (expectedRevision !== undefined) {
    assert.equal(draft.revision, expectedRevision, "unexpected authoritative draft revision");
  }

  const profiles = new Map(
    [...publicInstallProfiles(), ...publicCliDeployOnlyProfiles()].map((profile) => [
      profile.productId,
      profile
    ])
  );
  const plans = { ...cliInstallPlans(), ...cliDeployOnlyPlans() };
  const seenIds = new Set();
  const seenProfiles = new Set();
  const rows = [];

  for (const product of productsFromDraft(draft)) {
    if (!new Set(["cli", "cli-official", "cli-deploy-only"]).has(product.productType)) continue;
    const productId = product.id;
    assert.ok(!seenIds.has(productId), `duplicate CLI product ${productId}`);
    seenIds.add(productId);
    assert.equal(product.kind, "CLI", `${productId} must remain a CLI`);

    const registration = INSTALL_REGISTRY[productId] || null;
    const profile = profiles.get(productId) || null;
    const plan = plans[productId] || null;

    if (product.productType === "cli-official") {
      assert.ok(DRAFT89_CLI_REVIEW_BLOCKERS[productId], `${productId} needs a blocker decision`);
      assert.equal(registration, null, `${productId} must not have a managed registration`);
      assert.equal(profile, null, `${productId} must not have a local profile`);
      assert.equal(plan, null, `${productId} must not have an executable plan`);
      assert.equal(product.moduleId, "cli-official");
      assert.equal(product.installProfileId, "");
      assert.ok(sameValues(product.capabilities, ["website", "tutorial"]));
      rows.push({
        productId,
        vendorId: product.vendorId,
        status: "official-blocked",
        profileId: "",
        driver: "",
        requirements: [],
        capabilities: product.capabilities,
        phases: [],
        blocker: DRAFT89_CLI_REVIEW_BLOCKERS[productId].reason
      });
      continue;
    }

    if (product.productType === "cli-deploy-only") {
      assert.ok(profile && plan, `${productId} needs a deploy-only profile and plan`);
      assert.equal(product.moduleId, "cli-deploy-only");
      assert.equal(profile.moduleId, product.moduleId);
      assert.equal(profile.id, product.installProfileId);
      assert.ok(!seenProfiles.has(profile.id), `duplicate profile ${profile.id}`);
      seenProfiles.add(profile.id);
      assert.ok(sameValues(product.capabilities, profile.capabilities));
      assert.ok(sameValues(product.capabilities, ["website", "tutorial", "install", "open"]));
      rows.push({
        productId,
        vendorId: product.vendorId,
        status: "deploy-only",
        profileId: profile.id,
        driver: driverIdForPlan(plan),
        requirements: plan.requirements,
        capabilities: product.capabilities,
        phases: ["environment-check", "deploy", "recheck", "open-terminal", "receipt"],
        blocker: "update, repair and uninstall are intentionally unavailable"
      });
      continue;
    }

    assert.ok(registration, `${productId} needs an install registration`);
    assert.equal(registration.mode, INSTALL_MODES.MANAGED_CLI, `${productId} must be managed-cli`);
    assert.ok(profile && plan, `${productId} needs a fixed local profile and plan`);
    assert.equal(product.moduleId, registration.moduleId, `${productId} module mismatch`);
    assert.equal(product.installProfileId, registration.profileId, `${productId} profile mismatch`);
    assert.equal(profile.id, registration.profileId, `${productId} public profile mismatch`);
    assert.equal(profile.vendorId, product.vendorId, `${productId} vendor mismatch`);
    assert.ok(!seenProfiles.has(profile.id), `duplicate profile ${profile.id}`);
    seenProfiles.add(profile.id);
    const excludedProfileCapabilities = excludedProfileCapabilitiesFor(productId);
    const authorizedRegistrationCapabilities = subtractValues(registration.capabilities, excludedProfileCapabilities);
    const authorizedProfileCapabilities = subtractValues(profile.capabilities, excludedProfileCapabilities);
    assert.ok(sameValues(product.requirements, registration.requirements));
    for (const capability of excludedProfileCapabilities) {
      assert.equal(
        product.capabilities.includes(capability),
        false,
        `${productId} must not claim excluded profile capability ${capability}`
      );
      assert.equal(
        registration.capabilities.includes(capability) && profile.capabilities.includes(capability),
        true,
        `${productId} exclusion must match an actual local profile capability`
      );
    }
    assert.ok(sameValues(product.capabilities, authorizedRegistrationCapabilities));
    assert.ok(sameValues(product.capabilities, authorizedProfileCapabilities));
    for (const capability of MANAGED_CAPABILITIES) {
      assert.ok(product.capabilities.includes(capability), `${productId} misses ${capability}`);
    }

    const driver = driverIdForPlan(plan);
    assert.ok(CLI_DRIVER_IDS.includes(driver), `${productId} has unknown driver ${driver}`);
    const hasUpdate = product.capabilities.includes("update");
    const hasRepair = product.capabilities.includes("repair");
    if (FULL_RECONCILE_DRIVERS.has(driver)) {
      assert.equal(hasUpdate, true, `${productId} needs update`);
      assert.equal(hasRepair, true, `${productId} needs repair`);
    } else if (driver === "wsl-managed") {
      assert.equal(hasUpdate, true, `${productId} keeps its fixed WSL update`);
      const repairExcluded = excludedProfileCapabilities.includes("repair");
      assert.equal(
        hasRepair,
        plan.repairStrategy === "rebuild-owned-prefix" && !repairExcluded,
        `${productId} must not claim WSL repair without the exact owned-prefix rebuild contract`
      );
    } else {
      assert.equal(driver, "companion-runtime", `${productId} has unsupported partial driver`);
      assert.equal(hasUpdate, false, `${productId} must not claim companion update`);
      assert.equal(hasRepair, false, `${productId} must not claim companion repair`);
    }
    rows.push({
      productId,
      vendorId: product.vendorId,
      status: hasUpdate && hasRepair ? "managed-ready" : "managed-partial",
      profileId: profile.id,
      driver,
      requirements: plan.requirements,
      capabilities: product.capabilities,
      excludedProfileCapabilities,
      phases: ["environment-check", "deploy", "recheck", "open-terminal", "receipt-owned-uninstall"],
      blocker: hasRepair ? "" : "capability intentionally withheld by fixed driver or catalog contract"
    });
  }

  const officialIds = rows.filter((row) => row.status === "official-blocked").map((row) => row.productId).sort();
  assert.deepEqual(Object.keys(DRAFT89_CLI_REVIEW_BLOCKERS).sort(), officialIds);
  assert.equal(Object.keys(plans).length, rows.filter((row) => row.status !== "official-blocked").length);
  assert.ok(CLI_DRIVER_OPERATIONS.every((operation) => ["status", "discover", "open", "reconcile", "uninstall"].includes(operation)));

  const active6 = fs.readFileSync(ACTIVE6_REPORT_PATH, "utf8");
  assert.match(active6, /Windows desktop validation/i);
  const summary = Object.fromEntries(
    ["managed-ready", "managed-partial", "deploy-only", "official-blocked"].map((status) => [
      status,
      rows.filter((row) => row.status === status).length
    ])
  );
  return {
    source: {
      revision: draft.revision,
      updatedAt: draft.updatedAt,
      activeReleaseId: state.activeReleaseId,
      activeCatalogVersion: state.activeCatalogVersion,
      active6Scope: "desktop-only; it is not CLI installation acceptance"
    },
    summary,
    rows: rows.sort((left, right) => left.productId.localeCompare(right.productId))
  };
}

function main() {
  const requested = new Set(process.argv.slice(2));
  const coverage = buildCoverage();
  if (requested.size) {
    const selected = coverage.rows.filter((row) => requested.has(row.productId));
    assert.equal(selected.length, requested.size, "unknown product in CLI coverage matrix");
    coverage.rows = selected;
  }
  process.stdout.write(`${JSON.stringify(coverage, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildCoverage, readState };
