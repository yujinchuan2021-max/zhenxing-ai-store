"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const activeCatalog = require("../admin/data/catalog-v1.json");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  resolveCatalogIconUrls
} = require("../shared/catalog-icon-runtime.cjs");
const {
  verifyCatalogRelease
} = require("../shared/catalog-release.cjs");

function localizedCatalog() {
  const catalog = structuredClone(activeCatalog);
  catalog.brand.localized = {
    en: { slogan: "AI for everyone" }
  };
  catalog.extraSections.push({
    id: "localized-contract",
    title: "本地化合同",
    description: "测试目录本地化合同。",
    enabled: true,
    url: "https://example.com/localized-contract",
    localized: { en: { title: "Localization contract" } }
  });
  catalog.community.localized = {
    en: {
      title: "ZhenXing AI Community",
      description: "Share practical AI tools and workflows."
    }
  };
  catalog.home.banners[0].localized = {
    en: {
      eyebrow: "AI HUB",
      title: "One catalog for practical AI",
      description: "Discover reviewed products and resources.",
      action: "Browse vendors"
    }
  };
  const slide = catalog.homeCarousel.slides[0];
  slide.localized = {
    en: {
      imageAlt: "A reviewed AI catalog",
      title: "Build with trusted AI tools",
      description: "Start from a reviewed catalog."
    }
  };
  slide.primaryAction.localized = { en: { label: "Browse tools" } };
  if (slide.secondaryAction) {
    slide.secondaryAction.localized = { en: { label: "Learn more" } };
  }
  const vendor = catalog.vendors[0];
  vendor.localized = {
    en: { name: "Example vendor", description: "A reviewed AI vendor." }
  };
  vendor.products[0].localized = {
    en: { name: "Example product", description: "A reviewed AI product." }
  };
  catalog.resourceStores[0].localized = {
    en: { label: "Skill Store" }
  };
  catalog.resources[0].localized = {
    en: { name: "Example resource", description: "A reviewed AI resource." }
  };
  return catalog;
}

const LOCALIZED_RECORDS = Object.freeze([
  ["Brand", (catalog) => catalog.brand.localized],
  ["ExtraSection", (catalog) => catalog.extraSections[0].localized],
  ["Community", (catalog) => catalog.community.localized],
  ["CatalogBanner", (catalog) => catalog.home.banners[0].localized],
  ["HomeCarouselSlide", (catalog) => catalog.homeCarousel.slides[0].localized],
  ["HomeCarouselAction", (catalog) =>
    catalog.homeCarousel.slides[0].primaryAction.localized],
  ["Vendor", (catalog) => catalog.vendors[0].localized],
  ["Product", (catalog) => catalog.vendors[0].products[0].localized],
  ["ResourceStore", (catalog) => catalog.resourceStores[0].localized],
  ["Resource", (catalog) => catalog.resources[0].localized]
]);

function legacyCatalog() {
  return {
    schemaVersion: 1,
    brand: { name: "AI Hub", mark: "A", slogan: "目录" },
    home: {
      banners: [{
        eyebrow: "AI HUB",
        title: "目录",
        description: "目录说明。",
        action: "查看厂商"
      }],
      featuredVendorIds: ["example"]
    },
    vendors: [{
      id: "example",
      name: "Example",
      initial: "E",
      mark: "E",
      color: "#112233",
      description: "示例厂商。",
      website: "https://example.com",
      tutorial: "https://example.com/docs",
      products: [{
        id: "example-web",
        name: "Example Web",
        kind: "其他产品",
        category: "AI 对话",
        description: "示例产品。",
        website: "https://example.com/app",
        tutorial: "https://example.com/docs",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }]
    }]
  };
}

function releaseFixture(t) {
  const rootDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-localized-release-")
  );
  t.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const trustedKeys = [{
    keyId: "localized-contract-test",
    publicKey: publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64")
  }];
  return {
    trustedKeys,
    store: createReleaseStore({
      rootDirectory,
      clock: () => "2026-08-12T08:00:00.000Z",
      signingKeyProvider: async () => ({
        keyId: "localized-contract-test",
        privateKey
      })
    })
  };
}

test("localized English content survives schema, Admin draft, signed release, and remote projection", async (t) => {
  const catalog = localizedCatalog();
  assert.doesNotThrow(() => validateCatalog(structuredClone(catalog)));

  const { store, trustedKeys } = releaseFixture(t);
  const draft = await store.saveDraft({ catalog, expectedRevision: 0 });
  const stored = (await store.readState()).draft.catalog;
  for (const [name, read] of LOCALIZED_RECORDS) {
    assert.deepEqual(read(draft.catalog), read(catalog), `${name} draft response`);
    assert.deepEqual(read(stored), read(catalog), `${name} Admin round trip`);
  }

  const published = await store.publish({
    channel: "v2",
    expectedDraftRevision: 1,
    expectedActiveCatalogVersion: 0
  });
  const verified = verifyCatalogRelease(published.envelope, {
    trustedKeys,
    clientId: "localized-contract-test-client"
  });
  const projected = resolveCatalogIconUrls(
    verified.catalog,
    "https://zhenxingai.com/catalog-release.json"
  );
  for (const [name, read] of LOCALIZED_RECORDS) {
    assert.deepEqual(read(verified.catalog), read(catalog), `${name} signed release`);
    assert.deepEqual(read(projected), read(catalog), `${name} remote projection`);
  }

  const tampered = structuredClone(published.envelope);
  tampered.payload.catalog.resources[0].localized.en.description = "Tampered";
  assert.throws(
    () => verifyCatalogRelease(tampered, {
      trustedKeys,
      clientId: "localized-contract-test-client"
    }),
    /签名|signature/i
  );
});

test("active catalogs without localization remain valid", () => {
  assert.doesNotThrow(() => validateCatalog(structuredClone(activeCatalog)));
});

test("localized English records are complete, exact, and bounded", () => {
  const cases = [
    ["partial brand", (catalog) => {
      catalog.brand.localized.en = {};
    }],
    ["extra section localized field", (catalog) => {
      catalog.extraSections[0].localized.en.description = "Description";
    }],
    ["partial community", (catalog) => {
      delete catalog.community.localized.en.description;
    }],
    ["unknown locale", (catalog) => {
      catalog.vendors[0].localized.zh = {
        name: "厂商",
        description: "描述"
      };
    }],
    ["partial banner", (catalog) => {
      delete catalog.home.banners[0].localized.en.action;
    }],
    ["missing slide imageAlt", (catalog) => {
      delete catalog.homeCarousel.slides[0].localized.en.imageAlt;
    }],
    ["extra slide field", (catalog) => {
      catalog.homeCarousel.slides[0].localized.en.caption = "Caption";
    }],
    ["overlong slide imageAlt", (catalog) => {
      catalog.homeCarousel.slides[0].localized.en.imageAlt = "x".repeat(201);
    }],
    ["partial action", (catalog) => {
      catalog.homeCarousel.slides[0].primaryAction.localized.en = {};
    }],
    ["partial vendor", (catalog) => {
      delete catalog.vendors[0].localized.en.description;
    }],
    ["extra product field", (catalog) => {
      catalog.vendors[0].products[0].localized.en.website = "Website";
    }],
    ["empty store label", (catalog) => {
      catalog.resourceStores[0].localized.en.label = "";
    }],
    ["overlong resource description", (catalog) => {
      catalog.resources[0].localized.en.description = "x".repeat(501);
    }]
  ];
  for (const [name, mutate] of cases) {
    const catalog = localizedCatalog();
    mutate(catalog);
    assert.throws(
      () => validateCatalog(catalog),
      undefined,
      name
    );
  }
});

test("schema v1 rejects localized banner, vendor, and product records", () => {
  const cases = [
    (catalog) => {
      catalog.home.banners[0].localized = {
        en: {
          eyebrow: "AI HUB",
          title: "Catalog",
          description: "Catalog description.",
          action: "Browse"
        }
      };
    },
    (catalog) => {
      catalog.vendors[0].localized = {
        en: { name: "Example", description: "Example vendor." }
      };
    },
    (catalog) => {
      catalog.vendors[0].products[0].localized = {
        en: { name: "Example Web", description: "Example product." }
      };
    }
  ];
  for (const addLocalized of cases) {
    const catalog = legacyCatalog();
    addLocalized(catalog);
    assert.throws(() => validateCatalog(catalog));
  }
});
