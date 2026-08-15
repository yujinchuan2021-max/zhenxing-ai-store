"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const { validatePublication, defaultReleaseSettings } = require("../admin/config-validation.cjs");
const { desktopDownloadOnlyProductIds, getDesktopDownloadOnlyProfile } = require("../shared/desktop-download-only.cjs");
const { getProductModule } = require("../shared/product-modules.cjs");
const { CAPABILITIES, getCliDeployOnlyProfile, validateCliDeployOnlyBinding } = require("../shared/cli-deploy-only.cjs");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
}

function fixture() {
  return readJson("admin/data/catalog-v1.json");
}

test("home carousel candidate is release-valid and zero slides remain a safe configuration", () => {
  const candidate = readJson("docs/home-carousel-draft83-candidate.json");
  const catalog = fixture();
  catalog.homeCarousel = candidate.homeCarousel;
  const report = validatePublication(validateCatalog(catalog), defaultReleaseSettings());
  assert.equal(report.summary.homeCarouselSlides, 3);
  catalog.homeCarousel.slides = [];
  assert.doesNotThrow(() => validateCatalog(catalog));
});

test("home carousel rejects executable URLs, unapproved routes, and action payload fields", () => {
  const candidate = readJson("docs/home-carousel-draft83-candidate.json");
  for (const mutate of [
    (slide) => (slide.imageUrl = "javascript:alert(1)"),
    (slide) => (slide.imageUrl = "file:///C:/secret.png"),
    (slide) => (slide.primaryAction.href = "/settings"),
    (slide) => (slide.primaryAction.command = "cmd.exe")
  ]) {
    const catalog = fixture();
    catalog.homeCarousel = structuredClone(candidate.homeCarousel);
    mutate(catalog.homeCarousel.slides[0]);
    assert.throws(() => validateCatalog(catalog), /首页视觉轮播配置无效/);
  }
});

test("carousel admin retains CRUD fields through the existing catalog API seam", () => {
  const admin = fs.readFileSync(path.join(__dirname, "..", "admin", "public", "app.js"), "utf8");
  for (const marker of ["add-carousel-slide", "move-carousel-slide", "delete-carousel-slide", "data-carousel-enabled", "data-carousel-autoplay"]) {
    assert.match(admin, new RegExp(marker));
  }
});

test("desktop candidate covers only the fixed download-only profiles", () => {
  const candidate = readJson("docs/desktop-download-only-rev83-binding-candidate.json");
  assert.deepEqual([...candidate.products].sort(), [...desktopDownloadOnlyProductIds].sort());
  assert.deepEqual(candidate.capabilities, getProductModule(candidate.moduleId).capabilities);
  for (const id of candidate.products) assert.ok(getDesktopDownloadOnlyProfile(id));
  for (const id of candidate.excluded) assert.equal(getDesktopDownloadOnlyProfile(id), null);
});

test("CLI candidate selects only Anytype's fixed deploy-only profile", () => {
  const candidate = readJson("docs/cli-deploy-only-backend-binding-candidate.json");
  const binding = candidate.candidates[0];
  const profile = getCliDeployOnlyProfile(binding.productId);
  assert.equal(profile.profileId, binding.installProfileId);
  assert.deepEqual(binding.proposedCapabilities, CAPABILITIES);
  assert.deepEqual(validateCliDeployOnlyBinding({
    productId: binding.productId,
    moduleId: binding.moduleId,
    installProfileId: binding.installProfileId,
    capabilities: binding.proposedCapabilities
  }).capabilities, CAPABILITIES);
  for (const field of candidate.module.forbiddenBackendFields) {
    assert.equal(validateCliDeployOnlyBinding({
      productId: binding.productId,
      moduleId: binding.moduleId,
      installProfileId: binding.installProfileId,
      capabilities: binding.proposedCapabilities,
      [field]: "x"
    }), null);
  }
});
