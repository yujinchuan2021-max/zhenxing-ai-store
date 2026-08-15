"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const inputs = Object.freeze({
  baseCatalogV3: {
    path: "docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json",
    sha256: "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20"
  },
  research: {
    path: "docs/research/deepseek-harness-first-party-evidence-2026-08-15.md",
    sha256: "19e8e294bf3abfb11fc37e4fd338d331818ceb03316510e6ea23e16a8d8b6b6b"
  }
});
const outputPath =
  "docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json";
const outputSha256 =
  "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7";
const revision = "47f943859bef60e4160492346772ded9b24f765a";
const repository = "https://github.com/deepseek-ai/deepseek-harness";
const product = Object.freeze({
  id: "deepseek-harness",
  enabled: true,
  order: 3,
  directoryKind: "ai-tool",
  name: "DeepSeek Harness",
  kind: "其他产品",
  category: "智能体",
  description:
    "DeepSeek 官方开源的 Developer Preview agent harness，可读取和写入 workspace、运行命令，并加载 plugins、Skills、MCP client 与 subagents；本目录仅打开固定说明，不安装、运行、配置或收集凭据。",
  website: repository,
  tutorial: `${repository}/blob/${revision}/README.md`,
  productType: "tutorial",
  moduleId: "tutorial-link",
  installProfileId: "",
  requirements: [],
  installPolicy: "open-tutorial",
  downloadPolicy: "none",
  signaturePolicy: "not-applicable",
  uninstallPolicy: "not-managed",
  capabilities: ["tutorial"]
});

function reject(message) {
  throw new Error(`DeepSeek Harness Product candidate rejected: ${message}`);
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function assertFrozenInputHashes(actualHashes) {
  for (const [name, input] of Object.entries(inputs)) {
    if (actualHashes?.[name] !== input.sha256) {
      reject(`frozen input drift: ${input.path}`);
    }
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function canonicalRepository(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.toLowerCase() !== "github.com" || parts.length < 2) return null;
    return `github:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
  } catch {
    return null;
  }
}

function hasSameProductIdentity(candidate, vendorId) {
  return String(candidate?.id || "").trim().toLowerCase() === product.id ||
    (vendorId === "deepseek" && normalizeText(candidate?.name) === normalizeText(product.name)) ||
    [candidate?.website, candidate?.tutorial]
      .map(canonicalRepository)
      .filter(Boolean)
      .includes(canonicalRepository(repository));
}

function assertNoProductDuplicates(vendors) {
  for (const vendor of vendors) {
    const duplicate = vendor.products.find((candidate) =>
      hasSameProductIdentity(candidate, vendor.id)
    );
    if (duplicate) reject(`semantic product identity already exists: ${duplicate.id}`);
  }
}

function assertNoHistoricalProductDuplicates(historyEntries) {
  const parsedEntries = historyEntries.map((entry) => ({
    ...entry,
    value: JSON.parse(entry.raw),
    actualSha256: sha256(entry.raw)
  }));
  const entriesByPath = new Map();
  for (const entry of parsedEntries) {
    if (entriesByPath.has(entry.path)) reject(`duplicate historical path: ${entry.path}`);
    entriesByPath.set(entry.path, entry);
  }

  const exactProductArray = (value) => {
    if (
      value?.candidateOnly !== true ||
      value?.freezeOnly !== true ||
      value?.publishable !== false ||
      !Array.isArray(value?.catalog?.vendors)
    ) return null;
    const owners = value.catalog.vendors.filter(({ id }) => id === "deepseek");
    if (owners.length !== 1 || !Array.isArray(owners[0].products)) return null;
    const matches = owners[0].products.filter(({ id }) => id === product.id);
    return matches.length === 1 && isDeepStrictEqual(matches[0], product)
      ? owners[0].products
      : null;
  };
  const anchor = entriesByPath.get(outputPath);
  const anchorIsFrozen =
    anchor?.actualSha256 === outputSha256 && exactProductArray(anchor.value) !== null;
  const hasVerifiedAncestry = (entry, visited = new Set()) => {
    if (exactProductArray(entry.value) === null || visited.has(entry.path)) return false;
    const nextVisited = new Set(visited).add(entry.path);
    for (const input of Object.values(entry.value.inputs || {})) {
      if (
        !input ||
        typeof input !== "object" ||
        !isDeepStrictEqual(Object.keys(input).sort(), ["path", "sha256"])
      ) continue;
      if (
        input.path === outputPath &&
        input.sha256 === outputSha256 &&
        anchorIsFrozen
      ) return true;
      const parent = entriesByPath.get(input.path);
      if (
        parent &&
        input.sha256 === parent.actualSha256 &&
        hasVerifiedAncestry(parent, nextVisited)
      ) return true;
    }
    return false;
  };

  for (const entry of parsedEntries) {
    if (entry.path === outputPath) continue;
    const inheritedProducts = hasVerifiedAncestry(entry)
      ? exactProductArray(entry.value)
      : null;
    let duplicate = false;
    const visit = (value, vendorId = "") => {
      if (duplicate || !value || typeof value !== "object") return;
      if (value === inheritedProducts) {
        let skipped = false;
        for (const child of value) {
          if (!skipped && isDeepStrictEqual(child, product)) {
            skipped = true;
            continue;
          }
          visit(child, "deepseek");
        }
        return;
      }
      if (!Array.isArray(value) && hasSameProductIdentity(value, vendorId)) {
        duplicate = true;
        return;
      }
      if (Array.isArray(value)) {
        for (const child of value) visit(child, vendorId);
        return;
      }
      const childVendorId = Array.isArray(value.products) && typeof value.id === "string"
        ? value.id
        : vendorId;
      for (const [key, child] of Object.entries(value)) {
        visit(child, key === "products" ? childVendorId : vendorId);
      }
    };
    visit(entry.value);
    if (duplicate) {
      reject(`historical semantic product identity already exists: ${entry.path}`);
    }
  }
}

function buildCandidate(baseCandidate, historyEntries = []) {
  if (
    baseCandidate?.candidateOnly !== true ||
    baseCandidate?.freezeOnly !== true ||
    baseCandidate?.publishable !== false ||
    baseCandidate?.catalog?.schemaVersion !== 3 ||
    baseCandidate.catalog.vendors?.length !== 375 ||
    baseCandidate.catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0) !== 615 ||
    baseCandidate.catalog.resources?.length !== 270 ||
    baseCandidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0) !== 821 ||
    baseCandidate.catalog.resourceConnections?.length !== 10
  ) reject("base catalog v3 contract mismatch");

  validateCatalog(baseCandidate.catalog);
  assertNoProductDuplicates(baseCandidate.catalog.vendors);
  assertNoHistoricalProductDuplicates(historyEntries);
  const owners = baseCandidate.catalog.vendors.filter(({ id }) => id === "deepseek");
  if (owners.length !== 1 || owners[0].products.length !== 3) {
    reject("DeepSeek vendor contract mismatch");
  }

  const catalog = structuredClone(baseCandidate.catalog);
  const deepseek = catalog.vendors.find(({ id }) => id === "deepseek");
  deepseek.products.push(structuredClone(product));
  validateCatalog(catalog);

  const summary = {
    vendors: catalog.vendors.length,
    products: catalog.vendors.reduce((count, vendor) => count + vendor.products.length, 0),
    resources: catalog.resources.length,
    targets: catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    resourceConnections: catalog.resourceConnections.length,
    appendedProducts: 1
  };
  assert.deepEqual(summary, {
    vendors: 375,
    products: 616,
    resources: 270,
    targets: 821,
    resourceConnections: 10,
    appendedProducts: 1
  });
  assert.deepEqual(catalog.resources, baseCandidate.catalog.resources);
  assert.deepEqual(catalog.resourceConnections, baseCandidate.catalog.resourceConnections);

  const reversed = structuredClone(catalog);
  const reversedDeepSeek = reversed.vendors.find(({ id }) => id === "deepseek");
  assert.deepEqual(reversedDeepSeek.products.pop(), product);
  assert.deepEqual(reversed, baseCandidate.catalog);

  return {
    schemaVersion: 1,
    candidateOnly: true,
    publishable: false,
    freezeOnly: true,
    targetRelease: "next-major",
    generatedAt: "2026-08-15T00:00:00.000Z",
    title: "DeepSeek Harness Product catalog v3 incremental candidate",
    inputs,
    summary,
    catalog,
    safety: {
      candidateOnly: true,
      freezeOnly: true,
      publishable: false,
      linkOnlyProduct: true,
      managedInstall: false,
      credentialsCollected: false,
      resourcesAdded: 0,
      resourceTargetsAdded: 0,
      resourceConnectionsAdded: 0,
      catalogWritten: false,
      stateWritten: false,
      signed: false,
      published: false
    }
  };
}

function historyEntries() {
  const researchDir = path.join(root, "docs/research");
  return fs.readdirSync(researchDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      /candidate|review|index/i.test(entry.name) &&
      entry.name !== path.basename(inputs.baseCatalogV3.path)
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((entry) => ({
      path: `docs/research/${entry.name}`,
      raw: fs.readFileSync(path.join(researchDir, entry.name), "utf8")
    }));
}

function main() {
  const rawInputs = Object.fromEntries(
    Object.entries(inputs).map(([name, input]) => [
      name,
      fs.readFileSync(path.join(root, input.path))
    ])
  );
  assertFrozenInputHashes(Object.fromEntries(
    Object.entries(rawInputs).map(([name, raw]) => [name, sha256(raw)])
  ));
  const candidate = buildCandidate(
    JSON.parse(rawInputs.baseCatalogV3.toString("utf8")),
    historyEntries()
  );
  fs.writeFileSync(
    path.join(root, outputPath),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify({ outputPath, summary: candidate.summary })}\n`);
}

if (require.main === module) main();

module.exports = {
  assertFrozenInputHashes,
  buildCandidate
};
