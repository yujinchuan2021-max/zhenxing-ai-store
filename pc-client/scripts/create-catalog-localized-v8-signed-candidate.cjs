"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  CATALOG_RELEASE_MAX_BYTES,
  catalogReleaseSha256,
  validateCatalogReleasePayload
} = require("../shared/catalog-release.cjs");
const { resolveCatalogIconUrls } = require("../shared/catalog-icon-runtime.cjs");
const { canonicalize } = require("../shared/signed-release.cjs");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED = Object.freeze({
  contentA: Object.freeze({
    role: "localized-content-a",
    authorityRoot: "docs/research",
    relativePath: "docs/research/catalog-english-content-a-active7-2026-08-12.json",
    sha256: "affa8c2d307037509d5f7a57b55535a146505a27e2635dd7d641eaec5d8d8e15"
  }),
  contentB: Object.freeze({
    role: "localized-content-b",
    authorityRoot: "docs/research",
    relativePath: "docs/research/resource-store-localized-en-content-candidate-active7-2026-08-12.json",
    sha256: "a62bfb02b02d77faffd07f38d747514357739ce26f49406c339ec219f5f89045"
  }),
  active7: Object.freeze({
    role: "signed-v2-active7",
    authorityRoot: "admin/published/catalog-store/releases",
    relativePath: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
    sha256: "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4",
    releaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    catalogVersion: 7
  })
});
const EXPECTED_STATS = Object.freeze({
  brand: 1,
  extraSection: 0,
  community: 1,
  catalogBanner: 2,
  carouselSlide: 3,
  carouselAction: 5,
  vendor: 375,
  product: 615,
  resourceStore: 4,
  resource: 250,
  records: 1256,
  values: 2509
});
const A_STATS = Object.freeze({
  brand: 1,
  extraSection: 0,
  community: 1,
  catalogBanner: 2,
  carouselSlide: 3,
  carouselAction: 5,
  vendor: 375,
  product: 615,
  resourceStore: 0,
  resource: 0,
  records: 1002,
  values: 2005
});
const SOURCE_CLOSURE_ALLOWLIST = Object.freeze([
  Object.freeze({ kind: "input", role: EXPECTED.contentA.role, relativePath: EXPECTED.contentA.relativePath, expectedSha256: EXPECTED.contentA.sha256 }),
  Object.freeze({ kind: "input", role: EXPECTED.contentB.role, relativePath: EXPECTED.contentB.relativePath, expectedSha256: EXPECTED.contentB.sha256 }),
  Object.freeze({ kind: "input", role: EXPECTED.active7.role, relativePath: EXPECTED.active7.relativePath, expectedSha256: EXPECTED.active7.sha256 }),
  Object.freeze({ kind: "tooling", role: "localized-v8-generator", relativePath: "scripts/create-catalog-localized-v8-signed-candidate.cjs" }),
  Object.freeze({ kind: "tooling", role: "release-store-read-contract", relativePath: "admin/release-store.cjs" }),
  Object.freeze({ kind: "tooling", role: "catalog-schema-contract", relativePath: "shared/catalog.cjs" }),
  Object.freeze({ kind: "tooling", role: "catalog-localization-contract", relativePath: "shared/catalog-localization.cjs" }),
  Object.freeze({ kind: "tooling", role: "catalog-release-contract", relativePath: "shared/catalog-release.cjs" }),
  Object.freeze({ kind: "tooling", role: "signed-envelope-contract", relativePath: "shared/signed-release.cjs" }),
  Object.freeze({ kind: "tooling", role: "remote-icon-projection-contract", relativePath: "shared/catalog-icon-runtime.cjs" }),
  Object.freeze({ kind: "test", role: "localized-v8-test-contract", relativePath: "tests/catalog-localized-v8-signed-candidate.test.cjs" })
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function normalizedPath(value) {
  return path.normalize(value).toLowerCase();
}

function normalizedRelativePath(root, filePath) {
  const relativePath = path.relative(path.resolve(root), path.resolve(filePath));
  if (
    relativePath === "" ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error("Source closure path escapes the fixed root");
  }
  return relativePath.replaceAll("\\", "/");
}

function regularUnlinkedNonReparse(filePath) {
  const metadata = fs.lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    return false;
  }
  return normalizedPath(fs.realpathSync.native(filePath)) === normalizedPath(path.resolve(filePath));
}

function filesBelow(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(entryPath));
    else if (entry.isFile()) result.push(entryPath);
  }
  return result.sort();
}

function findUniqueInput(authorityRoot, expectedSha256) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error("Expected input SHA-256 is invalid");
  }
  const matches = [];
  for (const filePath of filesBelow(authorityRoot)) {
    if (sha256(fs.readFileSync(filePath)) !== expectedSha256) continue;
    if (!regularUnlinkedNonReparse(filePath)) {
      throw new Error("Candidate input must be a regular non-reparse single-link file");
    }
    matches.push(filePath);
  }
  if (matches.length !== 1) {
    throw new Error("Expected exactly one candidate input for SHA-256");
  }
  return matches[0];
}

function inputRecord(filePath, authorityRoot, expectedSha256) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(sha256(bytes), expectedSha256, "candidate input hash drift");
  return {
    path: filePath,
    relativePath: path.relative(authorityRoot, filePath).replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: expectedSha256,
    value: JSON.parse(bytes.toString("utf8"))
  };
}

async function readFixedInputs(root = ROOT) {
  const contentAuthority = path.join(root, EXPECTED.contentA.authorityRoot);
  const releaseAuthority = path.join(root, EXPECTED.active7.authorityRoot);
  const contentAPath = findUniqueInput(contentAuthority, EXPECTED.contentA.sha256);
  const contentBPath = findUniqueInput(contentAuthority, EXPECTED.contentB.sha256);
  const active7Path = findUniqueInput(releaseAuthority, EXPECTED.active7.sha256);
  assert.equal(normalizedRelativePath(root, contentAPath), EXPECTED.contentA.relativePath);
  assert.equal(normalizedRelativePath(root, contentBPath), EXPECTED.contentB.relativePath);
  assert.equal(normalizedRelativePath(root, active7Path), EXPECTED.active7.relativePath);
  const contentA = inputRecord(contentAPath, root, EXPECTED.contentA.sha256);
  const contentB = inputRecord(contentBPath, root, EXPECTED.contentB.sha256);
  const activeInput = inputRecord(active7Path, root, EXPECTED.active7.sha256);

  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin/published/catalog-store"),
    signingKeyProvider: async () => {
      throw new Error("candidate input verification is read-only");
    }
  });
  const channel = await store.readChannel("v2");
  assert.equal(channel.activeRelease?.releaseId, EXPECTED.active7.releaseId);
  assert.equal(channel.activeCatalogVersion, EXPECTED.active7.catalogVersion);
  const release = await store.readRelease(EXPECTED.active7.releaseId, {
    channel: "v2"
  });
  assert.equal(release.release.sha256, EXPECTED.active7.sha256);
  assert.deepEqual(release.envelope, activeInput.value);
  return {
    contentA,
    contentB,
    active7: {
      ...activeInput,
      release: release.release,
      envelope: release.envelope,
      catalog: release.envelope.payload.catalog
    }
  };
}

function stripLocalized(value) {
  const copy = structuredClone(value);
  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== "object") return;
    delete item.localized;
    Object.values(item).forEach(visit);
  };
  visit(copy);
  return copy;
}

function localizationEntries(catalog) {
  const entries = [];
  const add = (type, id, value) => {
    if (value?.localized !== undefined) {
      entries.push({ type, id, localized: value.localized });
    }
  };
  add("brand", "brand", catalog.brand);
  for (const section of catalog.extraSections || []) {
    add("extraSection", section.id, section);
  }
  add("community", "community", catalog.community);
  (catalog.home?.banners || []).forEach((banner, index) =>
    add("catalogBanner", `banner-${index + 1}`, banner)
  );
  for (const slide of catalog.homeCarousel?.slides || []) {
    add("carouselSlide", slide.id, slide);
    add("carouselAction", `${slide.id}:primary`, slide.primaryAction);
    if (slide.secondaryAction) {
      add("carouselAction", `${slide.id}:secondary`, slide.secondaryAction);
    }
  }
  for (const vendor of catalog.vendors || []) {
    add("vendor", vendor.id, vendor);
    for (const product of vendor.products || []) {
      add("product", product.id, product);
    }
  }
  for (const store of catalog.resourceStores || []) {
    add("resourceStore", store.id, store);
  }
  for (const resource of catalog.resources || []) {
    add("resource", resource.id, resource);
  }
  return entries;
}

function localizationStats(catalog) {
  const result = {
    brand: 0,
    extraSection: 0,
    community: 0,
    catalogBanner: 0,
    carouselSlide: 0,
    carouselAction: 0,
    vendor: 0,
    product: 0,
    resourceStore: 0,
    resource: 0,
    records: 0,
    values: 0
  };
  for (const entry of localizationEntries(catalog)) {
    result[entry.type] += 1;
    result.records += 1;
    result.values += Object.keys(entry.localized?.en || {}).length;
  }
  return result;
}

function sameStats(actual, expected) {
  return isDeepStrictEqual(actual, expected);
}

function copyAFields(target, source) {
  target.brand.localized = structuredClone(source.brand.localized);
  target.community.localized = structuredClone(source.community.localized);
  target.home.banners.forEach((banner, index) => {
    banner.localized = structuredClone(source.home.banners[index].localized);
  });
  const sourceSlides = new Map(source.homeCarousel.slides.map((slide) => [slide.id, slide]));
  for (const slide of target.homeCarousel.slides) {
    const sourceSlide = sourceSlides.get(slide.id);
    slide.localized = structuredClone(sourceSlide.localized);
    slide.primaryAction.localized = structuredClone(sourceSlide.primaryAction.localized);
    if (slide.secondaryAction) {
      slide.secondaryAction.localized = structuredClone(sourceSlide.secondaryAction.localized);
    }
  }
  const sourceVendors = new Map(source.vendors.map((vendor) => [vendor.id, vendor]));
  for (const vendor of target.vendors) {
    const sourceVendor = sourceVendors.get(vendor.id);
    vendor.localized = structuredClone(sourceVendor.localized);
    const sourceProducts = new Map(sourceVendor.products.map((product) => [product.id, product]));
    for (const product of vendor.products) {
      product.localized = structuredClone(sourceProducts.get(product.id).localized);
    }
  }
}

function mergeLocalizedCatalog(inputs) {
  const activeCatalog = inputs.active7.catalog;
  const contentA = inputs.contentA.value;
  const contentB = inputs.contentB.value;
  if (localizationEntries(activeCatalog).length !== 0) {
    throw new Error("active7 localized baseline drift");
  }
  if (
    contentA.candidateOnly !== true ||
    contentA.publishable !== false ||
    contentA.source?.channel !== "v2" ||
    contentA.source?.releaseId !== EXPECTED.active7.releaseId ||
    contentA.source?.catalogVersion !== EXPECTED.active7.catalogVersion ||
    contentA.source?.envelopeFileSha256 !== EXPECTED.active7.sha256 ||
    !isDeepStrictEqual(stripLocalized(contentA.catalog), activeCatalog)
  ) {
    throw new Error("localized content A primary-field drift");
  }
  const aStats = localizationStats(contentA.catalog);
  if (!sameStats(aStats, A_STATS)) {
    throw new Error("localized content A scope or count drift");
  }
  if (
    contentB.candidateOnly !== true ||
    contentB.publishable !== false ||
    contentB.source?.releaseId !== EXPECTED.active7.releaseId ||
    contentB.source?.catalogVersion !== EXPECTED.active7.catalogVersion ||
    contentB.source?.releaseSha256 !== EXPECTED.active7.sha256 ||
    contentB.resourceStores?.length !== 4 ||
    contentB.resources?.length !== 250
  ) {
    throw new Error("localized content B source or count drift");
  }

  const aKeys = new Set(localizationEntries(contentA.catalog).map(({ type, id }) => `${type}:${id}`));
  const storeIds = new Set();
  const stores = new Map();
  for (const entry of contentB.resourceStores) {
    const key = `resourceStore:${entry.storeId}`;
    if (aKeys.has(key)) throw new Error("localized content A/B overlap");
    if (storeIds.has(entry.storeId)) throw new Error("localized store duplicate");
    storeIds.add(entry.storeId);
    stores.set(entry.storeId, entry.localized);
  }
  const resourceIds = new Set();
  const resources = new Map();
  const activeResources = new Map(activeCatalog.resources.map((resource) => [resource.id, resource]));
  for (const entry of contentB.resources) {
    const key = `resource:${entry.resourceId}`;
    if (aKeys.has(key)) throw new Error("localized content A/B overlap");
    if (resourceIds.has(entry.resourceId)) throw new Error("localized resource duplicate");
    const source = activeResources.get(entry.resourceId);
    if (!source || source.sourceKind !== entry.sourceKind) {
      throw new Error("localized resource primary-field drift");
    }
    resourceIds.add(entry.resourceId);
    resources.set(entry.resourceId, entry.localized);
  }
  if (
    activeCatalog.resourceStores.some((store) => !stores.has(store.id)) ||
    activeCatalog.resources.some((resource) => !resources.has(resource.id))
  ) {
    throw new Error("localized content B missing localized record");
  }

  const merged = structuredClone(activeCatalog);
  copyAFields(merged, contentA.catalog);
  for (const store of merged.resourceStores) {
    store.localized = structuredClone(stores.get(store.id));
  }
  for (const resource of merged.resources) {
    resource.localized = structuredClone(resources.get(resource.id));
  }
  validateCatalog(structuredClone(merged));
  if (!sameStats(localizationStats(merged), EXPECTED_STATS)) {
    throw new Error("merged localized count drift");
  }
  if (!isDeepStrictEqual(stripLocalized(merged), activeCatalog)) {
    throw new Error("merged primary-field drift");
  }
  return merged;
}

function fixedFileEvidence(root, entry) {
  const filePath = path.resolve(root, ...entry.relativePath.split("/"));
  if (normalizedRelativePath(root, filePath) !== entry.relativePath) {
    throw new Error("Source closure path is not canonical");
  }
  if (!fs.existsSync(filePath)) throw new Error("Source closure file is missing");
  if (!regularUnlinkedNonReparse(filePath)) {
    throw new Error("Source closure file must be regular, non-reparse, and single-link");
  }
  const bytes = fs.readFileSync(filePath);
  const digest = sha256(bytes);
  if (entry.expectedSha256 && digest !== entry.expectedSha256) {
    throw new Error("Source closure fixed input hash drift");
  }
  return {
    kind: entry.kind,
    role: entry.role,
    relativePath: entry.relativePath,
    bytes: bytes.length,
    sha256: digest
  };
}

function buildSourceClosure(root = ROOT) {
  const normalized = SOURCE_CLOSURE_ALLOWLIST.map(({ relativePath }) => relativePath);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Source closure allowlist contains duplicate paths");
  }
  for (const expected of Object.values(EXPECTED)) {
    const match = findUniqueInput(
      path.join(root, expected.authorityRoot),
      expected.sha256
    );
    if (normalizedRelativePath(root, match) !== expected.relativePath) {
      throw new Error("Source closure fixed input path drift");
    }
  }
  const manifest = {
    schema: "aihub-localized-catalog-v8-source-closure-v2",
    files: SOURCE_CLOSURE_ALLOWLIST.map((entry) => fixedFileEvidence(root, entry))
  };
  const canonical = canonicalize(manifest);
  return {
    manifest,
    canonical,
    sha256: sha256(Buffer.from(canonical, "utf8"))
  };
}

function validateSourceClosure(sourceClosure) {
  if (
    !sourceClosure ||
    Object.keys(sourceClosure).length !== 3 ||
    typeof sourceClosure.canonical !== "string" ||
    typeof sourceClosure.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(sourceClosure.sha256) ||
    canonicalize(sourceClosure.manifest) !== sourceClosure.canonical ||
    sha256(Buffer.from(sourceClosure.canonical, "utf8")) !== sourceClosure.sha256 ||
    sourceClosure.manifest?.schema !== "aihub-localized-catalog-v8-source-closure-v2" ||
    !Array.isArray(sourceClosure.manifest.files) ||
    sourceClosure.manifest.files.length !== SOURCE_CLOSURE_ALLOWLIST.length
  ) {
    throw new Error("Complete source closure is invalid");
  }
  sourceClosure.manifest.files.forEach((file, index) => {
    const expected = SOURCE_CLOSURE_ALLOWLIST[index];
    if (
      !file ||
      Object.keys(file).length !== 5 ||
      file.kind !== expected.kind ||
      file.role !== expected.role ||
      file.relativePath !== expected.relativePath ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      (expected.expectedSha256 && file.sha256 !== expected.expectedSha256)
    ) {
      throw new Error("Complete source closure file contract is invalid");
    }
  });
  return sourceClosure.sha256;
}

function estimateSignedEnvelopeBytes(payload) {
  const envelope = {
    schemaVersion: 1,
    kind: "catalog",
    keyId: "k".repeat(64),
    payload,
    signature: Buffer.alloc(64).toString("base64")
  };
  return Buffer.byteLength(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

function createUnsignedSigningHandoff({ catalog, inputs, sourceClosure }) {
  const sourceClosureSha256 = validateSourceClosure(sourceClosure);
  const normalizedCatalog = validateCatalog(structuredClone(catalog));
  if (!sameStats(localizationStats(normalizedCatalog), EXPECTED_STATS)) {
    throw new Error("localized signing handoff count drift");
  }
  if (!isDeepStrictEqual(stripLocalized(normalizedCatalog), inputs.active7.catalog)) {
    throw new Error("localized signing handoff primary-field drift");
  }
  const catalogSha256 = catalogReleaseSha256(normalizedCatalog);
  const payload = validateCatalogReleasePayload({
    schemaVersion: 1,
    releaseId: `catalog-v00000008-${catalogSha256.slice(0, 12)}-${sourceClosureSha256.slice(0, 8)}`,
    catalogVersion: 8,
    publishedAt: "2026-08-12T00:00:00.000Z",
    draftRevision: inputs.active7.envelope.payload.draftRevision + 1,
    parentReleaseId: EXPECTED.active7.releaseId,
    sourceReleaseId: null,
    notes: `0.1.82 localized catalog v8 signing handoff; source-closure-sha256=${sourceClosureSha256}`,
    rollout: { percentage: 100, salt: "localized-catalog-v8-candidate" },
    catalogSha256,
    catalog: normalizedCatalog
  });
  const projectedCatalog = resolveCatalogIconUrls(
    payload.catalog,
    "https://zhenxingai.com/catalog-release.json"
  );
  if (!isDeepStrictEqual(localizationEntries(projectedCatalog), localizationEntries(payload.catalog))) {
    throw new Error("localized signing handoff remote projection drift");
  }
  const estimatedSignedEnvelopeBytes = estimateSignedEnvelopeBytes(payload);
  if (estimatedSignedEnvelopeBytes > CATALOG_RELEASE_MAX_BYTES) {
    throw new Error("localized signing handoff exceeds the signed release size limit");
  }
  return {
    payload,
    projectedCatalog,
    catalogSha256,
    sourceClosureSha256,
    estimatedSignedEnvelopeBytes
  };
}

async function prepareUnsignedSigningHandoff(root = ROOT) {
  const inputs = await readFixedInputs(root);
  const catalog = mergeLocalizedCatalog(inputs);
  const sourceClosure = buildSourceClosure(root);
  return {
    ...createUnsignedSigningHandoff({ catalog, inputs, sourceClosure }),
    catalog,
    inputs,
    sourceClosure
  };
}

if (require.main === module) {
  process.stderr.write("Release must provide an approved key and trust closure before signing\n");
  process.exitCode = 1;
}

module.exports = {
  EXPECTED,
  EXPECTED_STATS,
  SOURCE_CLOSURE_ALLOWLIST,
  buildSourceClosure,
  findUniqueInput,
  localizationEntries,
  localizationStats,
  mergeLocalizedCatalog,
  prepareUnsignedSigningHandoff,
  readFixedInputs,
  stripLocalized
};
