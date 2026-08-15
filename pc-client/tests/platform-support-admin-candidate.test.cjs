"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  defaultReleaseSettings,
  validatePublication
} = require("../admin/config-validation.cjs");
const {
  platformSupportCandidateCapability,
  previewPlatformSupportCandidate,
  validateFixedProfilePlatformSupport,
  validateOptionalPlatformSupport
} = require("../admin/platform-support-candidate.cjs");

const NOW = "2026-08-07T00:00:00.000Z";
const support = (platform) => [{
  platform,
  runtime: "native",
  status: "supported",
  architectures: ["x64"],
  evidence: [{ kind: "first-party", url: `https://example.com/${platform}`, observedAt: NOW }]
}];

test("platform candidate accepts only shared validated product and resource support", () => {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, "../admin/published/catalog-store/state.json"), "utf8"));
  const baseline = state.draft.catalog;
  assert.equal(state.draft.revision, 89);
  assert.equal(baseline.vendors.reduce((total, vendor) => total + vendor.products.length, 0), 615);
  assert.equal(baseline.resources.length, 146);
  const catalog = structuredClone(baseline);
  const product = catalog.vendors[0].products[0];
  const resource = catalog.resources[0];
  product.platformSupport = support("windows");
  resource.platformSupport = support("macos");
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.doesNotThrow(() => validatePublication(catalog, defaultReleaseSettings()));
  assert.deepEqual(validateFixedProfilePlatformSupport(support("linux"), { now: NOW }), { configured: true });
  resource.targets[0].platformSupport = support("linux");
  assert.throws(() => validateCatalog(catalog));
  delete resource.targets[0].platformSupport;
  product.platformSupport = [{ ...support("windows")[0], command: "bad" }];
  assert.throws(() => validateCatalog(catalog));
  delete product.platformSupport;
  delete resource.platformSupport;
  assert.deepEqual(catalog, baseline);
});

test("admin editor exposes only controlled platform declarations and candidate preview", () => {
  const app = fs.readFileSync(path.join(__dirname, "../admin/public/app.js"), "utf8");
  assert.match(app, /data-platform-support-claim/);
  assert.match(app, /data-platform-support-evidence/);
  assert.match(app, /Platform support \(candidate-only\)/);
  assert.doesNotMatch(app, /data-platform-support-(?:command|args|env|headers|credentials|script|path)/);
});

test("candidate preview remains disabled and fails closed for missing, forged, or stale claims", () => {
  assert.deepEqual(platformSupportCandidateCapability(), { enabled: false });
  assert.throws(() => validateOptionalPlatformSupport([{ ...support("windows")[0], evidence: [{ kind: "first-party", url: "https://example.com/windows", observedAt: "2025-01-01T00:00:00.000Z" }] }], { now: NOW }));
  const result = previewPlatformSupportCandidate({
    resourceSupport: support("windows"), hostSupport: support("windows"), profileSupport: support("windows"),
    requested: { platform: "windows", runtime: "native", architecture: "x64", runtimeDependencies: [] }, now: NOW
  });
  assert.deepEqual(result, { enabled: false, available: true, managedEligible: false, reason: "PLATFORM_SUPPORT_CANDIDATE_DISABLED" });
  assert.deepEqual(previewPlatformSupportCandidate({ requested: {} }), { enabled: false, available: false, managedEligible: false, reason: "PLATFORM_PROJECTION_INPUT_INVALID" });
});
