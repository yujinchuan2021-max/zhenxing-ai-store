"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
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
const OUTPUT_PATH = path.join(
  ROOT,
  "docs",
  "research",
  "catalog-english-content-a-active7-2026-08-12.json"
);

const TRANSLATIONS_PATH = path.join(
  ROOT,
  "tests",
  "fixtures",
  "catalog-english-content-a-active7.translations.json"
);
const AUTHORED_TRANSLATIONS_PATH = path.join(
  ROOT,
  "tests",
  "fixtures",
  "catalog-english-content-a-active7.authored.cjs"
);
const INTEGRITY_MANIFEST_PATH = path.join(
  ROOT,
  "docs",
  "research",
  "catalog-english-content-a-active7-integrity-manifest-2026-08-12.json"
);
const translations = JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, "utf8"));
const authoredTranslations = require(AUTHORED_TRANSLATIONS_PATH);
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function allActions(catalog) {
  return catalog.homeCarousel.slides.flatMap((slide) =>
    [slide.primaryAction, slide.secondaryAction].filter(Boolean)
  );
}

function valueAudit(catalog, sourceCatalog, properNames) {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const actions = allActions(catalog);
  const values = [
    ...Object.values(catalog.brand.localized.en),
    ...Object.values(catalog.community.localized.en),
    ...catalog.home.banners.flatMap((banner) => Object.values(banner.localized.en)),
    ...catalog.homeCarousel.slides.flatMap((slide) => Object.values(slide.localized.en)),
    ...actions.flatMap((action) => Object.values(action.localized.en)),
    ...catalog.vendors.flatMap((vendor) => Object.values(vendor.localized.en)),
    ...products.flatMap((product) => Object.values(product.localized.en))
  ];
  const cjkNames = [
    ...catalog.vendors.map((vendor) => vendor.localized.en.name),
    ...products.map((product) => product.localized.en.name)
  ].filter((name) => /[\u3400-\u9fff]/u.test(name));
  const cjkDescriptions = [
    ...catalog.vendors.map((vendor) => vendor.localized.en.description),
    ...products.map((product) => product.localized.en.description)
  ].filter((description) => {
    let withoutProperNames = description;
    for (const name of properNames) {
      withoutProperNames = withoutProperNames.split(name).join("");
    }
    return /[\u3400-\u9fff]/u.test(withoutProperNames);
  });
  const stripped = structuredClone(catalog);
  const removeLocalized = (input) => {
    if (Array.isArray(input)) return input.forEach(removeLocalized);
    if (!input || typeof input !== "object") return;
    delete input.localized;
    Object.values(input).forEach(removeLocalized);
  };
  removeLocalized(stripped);
  return {
    localized: {
      brand: 1,
      community: 1,
      banner: catalog.home.banners.length,
      carouselSlide: catalog.homeCarousel.slides.length,
      carouselAction: actions.length,
      vendor: catalog.vendors.length,
      product: products.length,
      records: 2 + catalog.home.banners.length + catalog.homeCarousel.slides.length +
        actions.length + catalog.vendors.length + products.length,
      values: values.length
    },
    properNamePreserved: {
      vendorAndProductNames: cjkNames.length,
      values: cjkNames
    },
    untranslatedDescriptionFallbacks: cjkDescriptions.length,
    untranslatedDescriptionSamples: cjkDescriptions.slice(0, 20),
    emptyValues: values.filter((value) => typeof value !== "string" || value.length === 0).length,
    overlongValues: values.filter((value) => value.length > 500).length,
    extraFields: 0,
    primaryAndNonDisplayDrift:
      JSON.stringify(stripped) === JSON.stringify(sourceCatalog) ? 0 : 1
  };
}

const releaseBytes = fs.readFileSync(RELEASE_PATH);
const envelope = JSON.parse(releaseBytes);
const sourceCatalog = envelope.payload.catalog;
const catalog = structuredClone(sourceCatalog);
const properNames = [
  ...catalog.vendors.map((vendor) => vendor.name),
  ...catalog.vendors.flatMap((vendor) => vendor.products.map((product) => product.name))
]
  .filter((name) => /[\u3400-\u9fff]/u.test(name))
  .sort((left, right) => right.length - left.length);

if (translations.candidateLabel !== "0.1.82-localized-en-content-a") {
  throw new Error("Unexpected translation fixture label");
}
const vendorIds = new Set(catalog.vendors.map(({ id }) => id));
const productIds = new Set(catalog.vendors.flatMap(({ products }) => products.map(({ id }) => id)));
if (Object.keys(translations.vendors).length !== vendorIds.size ||
    Object.keys(translations.vendors).some((id) => !vendorIds.has(id))) {
  throw new Error("Vendor translation IDs do not exactly match active7");
}
if (Object.keys(translations.products).length !== productIds.size ||
    Object.keys(translations.products).some((id) => !productIds.has(id))) {
  throw new Error("Product translation IDs do not exactly match active7");
}
if (Object.keys(authoredTranslations.vendors).length !== vendorIds.size ||
    Object.keys(authoredTranslations.vendors).some((id) => !vendorIds.has(id))) {
  throw new Error("Authored vendor description IDs do not exactly match active7");
}
if (Object.keys(authoredTranslations.products).length !== productIds.size ||
    Object.keys(authoredTranslations.products).some((id) => !productIds.has(id))) {
  throw new Error("Authored product description IDs do not exactly match active7");
}
for (const description of [
  ...Object.values(authoredTranslations.vendors),
  ...Object.values(authoredTranslations.products)
]) {
  if (typeof description !== "string" || description.trim() !== description || !description) {
    throw new Error("Authored descriptions must be non-empty trimmed strings");
  }
}

catalog.brand.localized = { en: translations.home.brand };
catalog.community.localized = { en: translations.home.community };
catalog.home.banners.forEach((banner, index) => {
  banner.localized = { en: translations.home.banners[index] };
});
catalog.homeCarousel.slides.forEach((slide) => {
  const localized = translations.home.slides[slide.id];
  if (!localized) throw new Error(`Missing carousel localization: ${slide.id}`);
  slide.localized = {
    en: {
      imageAlt: localized.imageAlt,
      title: localized.title,
      description: localized.description
    }
  };
  slide.primaryAction.localized = { en: { label: localized.primaryAction } };
  if (slide.secondaryAction) {
    slide.secondaryAction.localized = { en: { label: localized.secondaryAction } };
  }
});
for (const vendor of catalog.vendors) {
  vendor.localized = {
    en: authoredTranslations.vendors[vendor.id]
      ? { ...translations.vendors[vendor.id], description: authoredTranslations.vendors[vendor.id] }
      : translations.vendors[vendor.id]
  };
  for (const product of vendor.products) {
    product.localized = {
      en: authoredTranslations.products[product.id]
        ? { ...translations.products[product.id], description: authoredTranslations.products[product.id] }
        : translations.products[product.id]
    };
  }
}

const audit = valueAudit(catalog, sourceCatalog, properNames);
audit.authoringDeclaration = {
  authoredVendors: Object.keys(authoredTranslations.vendors).length,
  authoredProducts: Object.keys(authoredTranslations.products).length,
  totalVendors: catalog.vendors.length,
  totalProducts: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
  complete: Object.keys(authoredTranslations.vendors).length === catalog.vendors.length &&
    Object.keys(authoredTranslations.products).length ===
      catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0)
};
const candidate = {
  schemaVersion: 1,
  candidateLabel: translations.candidateLabel,
  candidateOnly: true,
  publishable: false,
  generatedAt: "2026-08-12T00:00:00.000Z",
  source: {
    channel: "v2",
    releaseId: RELEASE_ID,
    catalogVersion: envelope.payload.catalogVersion,
    envelopeFileSha256: sha256(releaseBytes),
    productCount: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    vendorCount: catalog.vendors.length
  },
  audit,
  catalog
};

validateCatalog(structuredClone(catalog));
if (audit.primaryAndNonDisplayDrift !== 0) throw new Error("Primary or non-display field drift");
const integrityEntries = [];
const addIntegrityEntry = (objectType, objectId, localized) => integrityEntries.push({
  objectType,
  objectId,
  localizedContentSha256: sha256(Buffer.from(JSON.stringify(localized), "utf8"))
});
addIntegrityEntry("brand", "brand", catalog.brand.localized.en);
addIntegrityEntry("community", "community", catalog.community.localized.en);
catalog.home.banners.forEach((banner, index) =>
  addIntegrityEntry("banner", `banner-${index + 1}`, banner.localized.en)
);
catalog.homeCarousel.slides.forEach((slide) => {
  addIntegrityEntry("carousel-slide", slide.id, slide.localized.en);
  addIntegrityEntry("carousel-action", `${slide.id}:primary`, slide.primaryAction.localized.en);
  if (slide.secondaryAction) {
    addIntegrityEntry("carousel-action", `${slide.id}:secondary`, slide.secondaryAction.localized.en);
  }
});
for (const vendor of catalog.vendors) {
  addIntegrityEntry("vendor", vendor.id, vendor.localized.en);
  for (const product of vendor.products) {
    addIntegrityEntry("product", product.id, product.localized.en);
  }
}
const integrityManifest = {
  candidateLabel: translations.candidateLabel,
  candidateOnly: true,
  publishable: false,
  manifestKind: "localized-content-completeness-and-sha-map",
  recordCount: integrityEntries.length,
  entries: integrityEntries
};
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
fs.writeFileSync(INTEGRITY_MANIFEST_PATH, `${JSON.stringify(integrityManifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT_PATH, audit }, null, 2));
