"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-deepseek-harness-product-catalog-v3-candidate.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { resolveProductBehavior } = require("../shared/product-policy.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json";
const candidatePath = path.join(root, candidateRelativePath);
const baseRelativePath =
  "docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256Raw(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

test("DeepSeek Harness Product catalog v3 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
});

test("candidate appends one exact link-only Product and preserves all resources and relations", () => {
  const base = readJson(baseRelativePath);
  const candidate = readJson(candidateRelativePath);
  const deepseek = candidate.catalog.vendors.find(({ id }) => id === "deepseek");
  const product = deepseek.products.at(-1);

  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly", "catalog", "freezeOnly", "generatedAt", "inputs",
    "publishable", "safety", "schemaVersion", "summary", "targetRelease", "title"
  ]);
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.freezeOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.deepEqual(candidate.inputs, {
    baseCatalogV3: {
      path: baseRelativePath,
      sha256: "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20"
    },
    research: {
      path: "docs/research/deepseek-harness-first-party-evidence-2026-08-15.md",
      sha256: "19e8e294bf3abfb11fc37e4fd338d331818ceb03316510e6ea23e16a8d8b6b6b"
    }
  });
  for (const input of Object.values(candidate.inputs)) {
    assert.equal(
      sha256Raw(fs.readFileSync(path.join(root, input.path))),
      input.sha256,
      input.path
    );
  }
  assert.deepEqual(candidate.summary, {
    vendors: 375,
    products: 616,
    resources: 270,
    targets: 821,
    resourceConnections: 10,
    appendedProducts: 1
  });
  assert.equal(deepseek.products.length, 4);
  assert.deepEqual(Object.keys(product).sort(), [
    "capabilities", "category", "description", "directoryKind", "downloadPolicy",
    "enabled", "id", "installPolicy", "installProfileId", "kind", "moduleId",
    "name", "order", "productType", "requirements", "signaturePolicy", "tutorial",
    "uninstallPolicy", "website"
  ]);
  assert.deepEqual(product, {
    id: "deepseek-harness",
    enabled: true,
    order: 3,
    directoryKind: "ai-tool",
    name: "DeepSeek Harness",
    kind: "其他产品",
    category: "智能体",
    description:
      "DeepSeek 官方开源的 Developer Preview agent harness，可读取和写入 workspace、运行命令，并加载 plugins、Skills、MCP client 与 subagents；本目录仅打开固定说明，不安装、运行、配置或收集凭据。",
    website: "https://github.com/deepseek-ai/deepseek-harness",
    tutorial:
      "https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/README.md",
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
  assert.doesNotThrow(() => validateCatalog(candidate.catalog));
  assert.deepEqual(candidate.catalog.resources, base.catalog.resources);
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.equal(
    candidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    821
  );
  assert.equal(
    candidate.catalog.resources.some(({ id }) => id === product.id),
    false
  );
  assert.equal(
    candidate.catalog.resourceConnections.some(({ resourceId, hostProductId }) =>
      resourceId === product.id || hostProductId === product.id
    ),
    false
  );

  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(
    reversed.vendors.find(({ id }) => id === "deepseek").products.pop(),
    product
  );
  assert.deepEqual(reversed, base.catalog);
  assert.deepEqual(candidate.safety, {
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
  });
});

test("Product policy exposes only the fixed tutorial and no managed install action", () => {
  const candidate = readJson(candidateRelativePath);
  const product = candidate.catalog.vendors
    .find(({ id }) => id === "deepseek")
    .products.at(-1);
  const behavior = resolveProductBehavior(product);

  assert.equal(behavior.clientManagedInstall, false);
  assert.equal(behavior.canInstall, false);
  assert.equal(behavior.managedDownload, false);
  assert.equal(behavior.managedCli, false);
  assert.equal(behavior.managedDesktop, false);
  assert.equal(behavior.opensDirectly, true);
  assert.equal(behavior.directUrl, product.tutorial);
  assert.deepEqual(behavior.entryPoints, [{
    type: "tutorial",
    label: "打开教程",
    url: product.tutorial
  }]);
  for (const forbidden of [
    "sourceKind", "risk", "versionRef", "agentTag", "agentChannel", "download",
    "officialDownload", "entryPoints", "extensions", "componentProductIds"
  ]) assert.equal(Object.hasOwn(product, forbidden), false, forbidden);
});

test("frozen inputs and base semantic Product identities fail closed", () => {
  assert.doesNotThrow(() => assertFrozenInputHashes({
    baseCatalogV3: "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20",
    research: "19e8e294bf3abfb11fc37e4fd338d331818ceb03316510e6ea23e16a8d8b6b6b"
  }));
  for (const key of ["baseCatalogV3", "research"]) {
    const hashes = {
      baseCatalogV3: "265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20",
      research: "19e8e294bf3abfb11fc37e4fd338d331818ceb03316510e6ea23e16a8d8b6b6b"
    };
    hashes[key] = "0".repeat(64);
    assert.throws(() => assertFrozenInputHashes(hashes), /frozen input drift/);
  }

  const base = readJson(baseRelativePath);
  const template = readJson(candidateRelativePath).catalog.vendors
    .find(({ id }) => id === "deepseek")
    .products.at(-1);
  const cases = [
    ["global id", (copy) => {
      copy.catalog.vendors[0].products.push({
        ...structuredClone(template),
        name: "Independent product",
        website: "https://example.com/independent",
        tutorial: "https://example.com/independent/readme"
      });
    }],
    ["normalized name and vendor", (copy) => {
      copy.catalog.vendors.find(({ id }) => id === "deepseek").products.push({
        ...structuredClone(template),
        id: "renamed-deepseek-agent-harness",
        name: "DeepSeek---Harness",
        website: "https://example.com/deepseek-agent",
        tutorial: "https://example.com/deepseek-agent/readme"
      });
    }],
    ["canonical repository", (copy) => {
      copy.catalog.vendors[0].products.push({
        ...structuredClone(template),
        id: "renamed-independent-harness",
        name: "Independent workspace agent",
        website: "https://github.com/deepseek-ai/deepseek-harness/",
        tutorial: "https://example.com/independent/readme"
      });
    }]
  ];
  for (const [label, mutate] of cases) {
    const copy = structuredClone(base);
    mutate(copy);
    assert.throws(() => buildCandidate(copy), /semantic product identity|catalog/i, label);
  }
  const proseOnly = [{
    path: "docs/research/prose-only-deepseek-harness-review.json",
    raw: JSON.stringify({ notes: "DeepSeek Harness https://github.com/deepseek-ai/deepseek-harness" })
  }];
  assert.doesNotThrow(() => buildCandidate(base, proseOnly));
  assert.throws(
    () => buildCandidate(base, [{ path: "docs/research/malformed.json", raw: "{" }]),
    /JSON/
  );
});

test("history dedupe skips only one hash-verified inherited DeepSeek Harness Product", () => {
  const base = readJson(baseRelativePath);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const current = JSON.parse(currentRaw);
  const currentSha = sha256Raw(currentRaw);
  const currentProduct = current.catalog.vendors
    .find(({ id }) => id === "deepseek")
    .products.at(-1);
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const successorPath =
    "docs/research/future-deepseek-harness-product-catalog-v3-candidate.json";
  const direct = structuredClone(current);
  direct.inputs = {
    parent: { path: candidateRelativePath, sha256: currentSha }
  };
  const inherited = direct.catalog.vendors
    .find(({ id }) => id === "deepseek")
    .products.filter(({ id }) => id === "deepseek-harness");

  assert.equal(
    currentSha,
    "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7"
  );
  assert.equal(inherited.length, 1);
  assert.deepEqual(inherited[0], currentProduct);
  const directRaw = JSON.stringify(direct);
  assert.doesNotThrow(() => buildCandidate(base, [anchor, {
    path: successorPath,
    raw: directRaw
  }]));

  const extraCanonicalIdentity = structuredClone(direct);
  extraCanonicalIdentity.catalog.vendors[0].products.push({
    id: "renamed-independent-harness-copy",
    name: "Renamed agent workspace",
    website: "https://github.com/deepseek-ai/deepseek-harness"
  });
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-independent-harness-copy-candidate.json",
      raw: JSON.stringify(extraCanonicalIdentity)
    }]),
    /historical semantic product identity already exists/
  );

  const duplicateExact = structuredClone(direct);
  duplicateExact.catalog.vendors
    .find(({ id }) => id === "deepseek")
    .products.push(structuredClone(currentProduct));
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/successor-with-two-exact-harness-products-candidate.json",
      raw: JSON.stringify(duplicateExact)
    }]),
    /historical semantic product identity already exists/
  );

  for (const [label, mutate] of [
    ["forged-hash", (value) => { value.inputs.parent.sha256 = "0".repeat(64); }],
    ["forged-path", (value) => {
      value.inputs.parent.path = "docs/research/not-the-frozen-product-candidate.json";
    }]
  ]) {
    const forged = structuredClone(direct);
    mutate(forged);
    assert.throws(
      () => buildCandidate(base, [anchor, {
        path: `docs/research/${label}-harness-successor-candidate.json`,
        raw: JSON.stringify(forged)
      }]),
      /historical semantic product identity already exists/
    );
  }

  const unknownAncestor = structuredClone(direct);
  unknownAncestor.inputs = {
    parent: {
      path: "docs/research/unknown-harness-ancestor-candidate.json",
      sha256: "f".repeat(64)
    }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/unknown-harness-successor-candidate.json",
      raw: JSON.stringify(unknownAncestor)
    }]),
    /historical semantic product identity already exists/
  );

  const transitive = structuredClone(direct);
  transitive.inputs = {
    parent: { path: successorPath, sha256: sha256Raw(directRaw) }
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, {
    path: successorPath,
    raw: directRaw
  }, {
    path: "docs/research/transitive-harness-successor-candidate.json",
    raw: JSON.stringify(transitive)
  }]));

  const cycleA = structuredClone(direct);
  const cycleB = structuredClone(direct);
  cycleA.inputs = {
    parent: { path: "docs/research/harness-cycle-b-candidate.json", sha256: "a".repeat(64) }
  };
  cycleB.inputs = {
    parent: { path: "docs/research/harness-cycle-a-candidate.json", sha256: "b".repeat(64) }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/harness-cycle-a-candidate.json",
      raw: JSON.stringify(cycleA)
    }, {
      path: "docs/research/harness-cycle-b-candidate.json",
      raw: JSON.stringify(cycleB)
    }]),
    /historical semantic product identity already exists/
  );
});

test("generator is byte-idempotent", () => {
  const run = () => childProcess.spawnSync(
    process.execPath,
    ["scripts/generate-deepseek-harness-product-catalog-v3-candidate.cjs"],
    { cwd: root, encoding: "utf8", timeout: 30_000 }
  );
  const first = run();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstRaw = fs.readFileSync(candidatePath, "utf8");
  const second = run();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondRaw = fs.readFileSync(candidatePath, "utf8");

  assert.equal(firstRaw, secondRaw);
  assert.equal(
    sha256Raw(secondRaw),
    "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7"
  );
});
