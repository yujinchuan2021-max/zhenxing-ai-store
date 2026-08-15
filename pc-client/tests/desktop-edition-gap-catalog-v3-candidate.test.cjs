"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFrozenInputHashes,
  buildCandidate,
  desktopProducts,
  inputs
} = require("../scripts/generate-desktop-edition-gap-catalog-v3-candidate.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { resolveOfficialDownloadUrl } = require("../shared/official-download-page.cjs");
const { resolveProductBehavior } = require("../shared/product-policy.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(
  root,
  "docs/research/desktop-edition-gap-catalog-v3-candidate-2026-08-15.json"
);
const expectedDesktopIds = [
  "minimax-agent",
  "notion-desktop",
  "replit-agent",
  "flowith-os",
  "gemini-web",
  "baidu-comate",
  "kortix-command-center",
  "github-copilot"
];

test("desktop edition gap catalog v3 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function productsById(catalog) {
  return new Map(catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, { vendorId: vendor.id, product }])
  ));
}

test("candidate updates seven identities, appends FlowithOS, and preserves the catalog remainder", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const candidate = readJson(path.relative(root, candidatePath));
  const baseProducts = productsById(base.catalog);
  const nextProducts = productsById(candidate.catalog);

  assert.deepEqual(candidate.inputs, inputs);
  for (const input of Object.values(inputs)) {
    assert.equal(sha256(fs.readFileSync(path.join(root, input.path))), input.sha256);
  }
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.publishable, false);
  assert.deepEqual(candidate.summary, {
    vendors: 375,
    products: 617,
    resources: 280,
    targets: 866,
    resourceConnections: 10,
    updatedProducts: 7,
    appendedProducts: 1
  });
  assert.deepEqual(Object.keys(desktopProducts), expectedDesktopIds);
  for (const [id, expected] of Object.entries(desktopProducts)) {
    assert.deepEqual(nextProducts.get(id)?.product, expected, id);
  }
  assert.equal(baseProducts.has("flowith-os"), false);
  assert.deepEqual(nextProducts.get("minimax-cli"), baseProducts.get("minimax-cli"));
  assert.deepEqual(nextProducts.get("flowith-agent-neo"), baseProducts.get("flowith-agent-neo"));
  assert.deepEqual(candidate.catalog.resources, base.catalog.resources);
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.doesNotThrow(() => validateCatalog(candidate.catalog));

  const reversed = structuredClone(candidate.catalog);
  for (const id of expectedDesktopIds.filter((id) => id !== "flowith-os")) {
    const vendor = reversed.vendors.find(({ id: vendorId }) => vendorId === baseProducts.get(id).vendorId);
    vendor.products[vendor.products.findIndex((product) => product.id === id)] =
      structuredClone(baseProducts.get(id).product);
  }
  const flowith = reversed.vendors.find(({ id }) => id === "flowith");
  assert.deepEqual(flowith.products.pop(), desktopProducts["flowith-os"]);
  assert.deepEqual(reversed, base.catalog);
});

test("all eight desktop records are official-page only and expose no executable contract", () => {
  const candidate = readJson(path.relative(root, candidatePath));
  const byId = productsById(candidate.catalog);
  for (const id of Object.keys(desktopProducts)) {
    const product = byId.get(id).product;
    const behavior = resolveProductBehavior(product);
    assert.equal(product.productType, "desktop-official", id);
    assert.equal(product.moduleId, "desktop-official", id);
    assert.equal(product.installProfileId, "", id);
    assert.equal(product.officialDownload.kind, "download-page", id);
    assert.equal(resolveOfficialDownloadUrl(product.officialDownload, product.website), product.officialDownload.url);
    assert.equal(product.entryPoints.some((entry) => entry.type === "desktop" && Object.hasOwn(entry, "url")), false, id);
    assert.equal(Object.hasOwn(product, "download"), false, id);
    assert.equal(behavior.clientManagedInstall, false, id);
    assert.equal(behavior.canInstall, false, id);
    assert.equal(behavior.managedDownload, false, id);
    assert.equal(behavior.managedDesktop, false, id);
  }
  assert.match(byId.get("minimax-agent").product.description, /本地数据.*浏览器会话.*第三方账户/);
  assert.match(byId.get("flowith-os").product.description, /本地文件.*终端.*浏览器会话.*桌面应用/);
  for (const id of ["minimax-agent", "notion-desktop", "replit-agent"]) {
    assert.equal(byId.get(id).product.entryPoints.some(({ type }) => type === "web"), true, id);
  }
  assert.equal(byId.get("flowith-os").product.entryPoints.some(({ type }) => type === "web"), false);
  assert.equal(byId.get("gemini-web").product.entryPoints.some(({ type }) => type === "web"), true);
  assert.equal(byId.get("baidu-comate").product.entryPoints.some(({ type }) => type === "tutorial"), true);
  assert.equal(byId.get("kortix-command-center").product.entryPoints.some(({ type }) => type === "web"), true);
  assert.equal(byId.get("github-copilot").product.entryPoints.some(({ type }) => type === "tutorial"), true);
});

test("frozen inputs, base identities, and duplicate FlowithOS fail closed", () => {
  assert.doesNotThrow(() => assertFrozenInputHashes(Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [name, input.sha256])
  )));
  for (const key of Object.keys(inputs)) {
    const hashes = Object.fromEntries(
      Object.entries(inputs).map(([name, input]) => [name, input.sha256])
    );
    hashes[key] = "0".repeat(64);
    assert.throws(() => assertFrozenInputHashes(hashes), /frozen input drift/);
  }

  const base = readJson(inputs.baseCatalogV3.path);
  const wrongOwner = structuredClone(base);
  const minimax = wrongOwner.catalog.vendors.find(({ id }) => id === "minimax");
  const other = wrongOwner.catalog.vendors.find(({ id }) => id !== "minimax");
  other.products.push(minimax.products.splice(
    minimax.products.findIndex(({ id }) => id === "minimax-agent"),
    1
  )[0]);
  assert.throws(() => buildCandidate(wrongOwner), /existing product contract mismatch/);

  const duplicate = structuredClone(base);
  duplicate.catalog.vendors[0].products.push(structuredClone(desktopProducts["flowith-os"]));
  assert.throws(() => buildCandidate(duplicate), /FlowithOS product identity already exists|catalog/i);
});

test("pure candidate build is byte-idempotent", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const first = `${JSON.stringify(buildCandidate(base), null, 2)}\n`;
  const second = `${JSON.stringify(buildCandidate(base), null, 2)}\n`;
  assert.equal(first, second);
  assert.equal(first, fs.readFileSync(candidatePath, "utf8"));
});
