"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_ID = "catalog-v00000007-8c49e1972186-0cec5335";
const RELEASE_PATH = path.join(
  ROOT,
  "admin",
  "published",
  "catalog-store",
  "releases",
  `${RELEASE_ID}.json`
);
const CANDIDATE_PATH = path.join(
  ROOT,
  "docs",
  "research",
  "catalog-english-content-a-active7-2026-08-12.json"
);
const INTEGRITY_MANIFEST_PATH = path.join(
  ROOT,
  "docs",
  "research",
  "catalog-english-content-a-active7-integrity-manifest-2026-08-12.json"
);
const EXPECTED = JSON.parse(fs.readFileSync(
  path.join(__dirname, "fixtures", "catalog-english-content-a-active7.expected.json"),
  "utf8"
));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripLocalized(value) {
  if (Array.isArray(value)) return value.map(stripLocalized);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "localized")
      .map(([key, item]) => [key, stripLocalized(item)])
  );
}

function containsLocalized(value) {
  if (Array.isArray(value)) return value.some(containsLocalized);
  if (!value || typeof value !== "object") return false;
  return Object.hasOwn(value, "localized") || Object.values(value).some(containsLocalized);
}

test("active7 English content A candidate is complete and preserves source facts", () => {
  const releaseBytes = fs.readFileSync(RELEASE_PATH);
  const sourceCatalog = JSON.parse(releaseBytes).payload.catalog;
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, "utf8"));
  const integrityManifest = JSON.parse(fs.readFileSync(INTEGRITY_MANIFEST_PATH, "utf8"));
  const catalog = candidate.catalog;
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const actions = catalog.homeCarousel.slides.flatMap((slide) =>
    [slide.primaryAction, slide.secondaryAction].filter(Boolean)
  );

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.candidateLabel, "0.1.82-localized-en-content-a");
  assert.equal(candidate.source.releaseId, EXPECTED.releaseId);
  assert.equal(candidate.source.envelopeFileSha256, sha256(releaseBytes));
  assert.doesNotThrow(() => validateCatalog(structuredClone(catalog)));
  assert.equal(catalog.vendors.length, EXPECTED.counts.vendors);
  assert.equal(products.length, EXPECTED.counts.products);
  assert.equal(catalog.home.banners.length, EXPECTED.counts.banners);
  assert.equal(catalog.homeCarousel.slides.length, EXPECTED.counts.carouselSlides);
  assert.equal(actions.length, EXPECTED.counts.carouselActions);
  assert.equal(catalog.brand.localized.en.slogan, EXPECTED.home.brandSlogan);
  assert.equal(catalog.community.localized.en.title, EXPECTED.home.communityTitle);

  assert.deepEqual(Object.keys(catalog.brand.localized.en), ["slogan"]);
  assert.deepEqual(Object.keys(catalog.community.localized.en), ["title", "description"]);
  for (const banner of catalog.home.banners) {
    assert.deepEqual(Object.keys(banner.localized.en), ["eyebrow", "title", "description", "action"]);
  }
  for (const slide of catalog.homeCarousel.slides) {
    assert.deepEqual(Object.keys(slide.localized.en), ["imageAlt", "title", "description"]);
  }
  for (const action of actions) assert.deepEqual(Object.keys(action.localized.en), ["label"]);
  for (const vendor of catalog.vendors) {
    assert.deepEqual(Object.keys(vendor.localized.en), ["name", "description"]);
    for (const product of vendor.products) {
      assert.deepEqual(Object.keys(product.localized.en), ["name", "description"]);
    }
  }

  assert.deepEqual(stripLocalized(catalog), sourceCatalog);
  assert.equal(catalog.extraSections.some(containsLocalized), false);
  assert.equal(catalog.resourceStores.some(containsLocalized), false);
  assert.equal(catalog.resources.some(containsLocalized), false);
  assert.equal(candidate.audit.localized.vendor, EXPECTED.counts.vendors);
  assert.equal(candidate.audit.localized.product, EXPECTED.counts.products);
  assert.equal(candidate.audit.localized.records, 1002);
  assert.equal(candidate.audit.localized.values, 2005);
  assert.equal(
    candidate.audit.properNamePreserved.vendorAndProductNames,
    EXPECTED.properNamePreservedCount
  );
  assert.equal(candidate.audit.untranslatedDescriptionFallbacks, 0);
  assert.equal(candidate.audit.emptyValues, 0);
  assert.equal(candidate.audit.overlongValues, 0);
  assert.equal(candidate.audit.extraFields, 0);
  assert.equal(candidate.audit.primaryAndNonDisplayDrift, 0);
  assert.deepEqual(candidate.audit.authoringDeclaration, {
    authoredVendors: 375,
    authoredProducts: 615,
    totalVendors: 375,
    totalProducts: 615,
    complete: true
  });

  const localizedText = JSON.stringify({
    brand: catalog.brand.localized,
    community: catalog.community.localized,
    banners: catalog.home.banners.map(({ localized }) => localized),
    slides: catalog.homeCarousel.slides.map(({ localized, primaryAction, secondaryAction }) => ({
      localized,
      primaryAction: primaryAction.localized,
      secondaryAction: secondaryAction?.localized
    })),
    vendors: catalog.vendors.map(({ id, localized, products: vendorProducts }) => ({
      id,
      localized,
      products: vendorProducts.map(({ id: productId, localized: productLocalized }) => ({
        id: productId,
        localized: productLocalized
      }))
    }))
  });
  for (const bad of [
    "Mongolian edition",
    "requires must",
    "people objects",
    "language audio",
    "can can",
    "item records",
    "future source",
    "amount transformation",
    "security all",
    "on under text",
    "local prioritize",
    "letter with",
    "customers relationships manages",
    "services manages",
    "not and related",
    "application after app",
    "before app"
  ]) {
    assert.equal(localizedText.toLowerCase().includes(bad.toLowerCase()), false, bad);
  }
  assert.equal(
    /\b(can|must|is|are|was|were|the|and|or|to|in|with|for|of|a|an)\s+\1\b/i.test(localizedText),
    false,
    "repeated English helper word"
  );

  assert.equal(integrityManifest.candidateLabel, candidate.candidateLabel);
  assert.equal(integrityManifest.manifestKind, "localized-content-completeness-and-sha-map");
  assert.equal(integrityManifest.recordCount, 1002);
  assert.equal(integrityManifest.entries.length, 1002);
  assert.equal(new Set(integrityManifest.entries.map(({ objectType, objectId }) => `${objectType}:${objectId}`)).size, 1002);
  for (const entry of integrityManifest.entries) {
    assert.deepEqual(Object.keys(entry), ["objectType", "objectId", "localizedContentSha256"]);
    assert.match(entry.objectType, /^(brand|community|banner|carousel-slide|carousel-action|vendor|product)$/);
    assert.match(entry.localizedContentSha256, /^[a-f0-9]{64}$/);
  }
  const integrityMap = new Map(integrityManifest.entries.map((entry) => [
    `${entry.objectType}:${entry.objectId}`,
    entry.localizedContentSha256
  ]));
  const localizedSha = (value) => sha256(Buffer.from(JSON.stringify(value), "utf8"));
  assert.equal(integrityMap.get("brand:brand"), localizedSha(catalog.brand.localized.en));
  assert.equal(integrityMap.get("community:community"), localizedSha(catalog.community.localized.en));
  catalog.home.banners.forEach((banner, index) =>
    assert.equal(integrityMap.get(`banner:banner-${index + 1}`), localizedSha(banner.localized.en))
  );
  catalog.homeCarousel.slides.forEach((slide) => {
    assert.equal(integrityMap.get(`carousel-slide:${slide.id}`), localizedSha(slide.localized.en));
    assert.equal(
      integrityMap.get(`carousel-action:${slide.id}:primary`),
      localizedSha(slide.primaryAction.localized.en)
    );
    if (slide.secondaryAction) {
      assert.equal(
        integrityMap.get(`carousel-action:${slide.id}:secondary`),
        localizedSha(slide.secondaryAction.localized.en)
      );
    }
  });
  for (const vendor of catalog.vendors) {
    assert.equal(integrityMap.get(`vendor:${vendor.id}`), localizedSha(vendor.localized.en));
    for (const product of vendor.products) {
      assert.equal(integrityMap.get(`product:${product.id}`), localizedSha(product.localized.en));
    }
  }
});

test("schema v1 remains free of localized content", () => {
  const state = JSON.parse(fs.readFileSync(
    path.join(ROOT, "admin", "published", "catalog-store", "state.json"),
    "utf8"
  ));
  const v1 = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      "admin",
      "published",
      "catalog-store",
      "releases",
      `${state.activeReleaseId}.json`
    ),
    "utf8"
  )).payload.catalog;
  assert.equal(containsLocalized(v1), false);
});
