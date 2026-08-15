"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const {
  enabledProductIdsFromCatalog,
  workflowDependencyProjection
} = require("../shared/active-catalog-products.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { loadDevelopmentCatalog } = require("../shared/development-catalog.cjs");

const root = path.resolve(__dirname, "..");
const compositionPath =
  "docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json";
const compositionSha256 =
  "8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302";
const candidatePath =
  "docs/research/catalog-v3-resource-connections-candidate-2026-08-14.json";

function composition() {
  const raw = fs.readFileSync(path.join(root, compositionPath));
  assert.equal(
    crypto.createHash("sha256").update(raw).digest("hex"),
    compositionSha256,
    "frozen next-major composition drift"
  );
  return JSON.parse(raw.toString("utf8"));
}

function catalogV3(connections = composition().resourceConnections) {
  const catalog = structuredClone(composition().catalog);
  catalog.schemaVersion = 3;
  catalog.resourceConnections = structuredClone(connections);
  return catalog;
}

function legacyCatalog() {
  return {
    schemaVersion: 1,
    vendors: [{
      id: "example",
      name: "Example",
      initial: "E",
      mark: "E",
      color: "#123456",
      description: "示例厂商",
      website: "https://example.com",
      tutorial: "https://example.com/docs",
      products: [{
        id: "example-web",
        name: "Example Web",
        kind: "其他产品",
        category: "AI 对话",
        description: "示例网页产品",
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

const parityCases = [
  {
    name: "fixed four resource stores",
    pattern: /生态资源商店必须包含固定的四类频道/,
    mutate(catalog) {
      catalog.resourceStores.pop();
    }
  },
  {
    name: "unsupported Resource field",
    pattern: /生态资源包含客户端不支持的字段/,
    mutate(catalog) {
      unconnectedResource(catalog).unsupportedParityField = true;
    }
  },
  {
    name: "invalid product directoryKind",
    pattern: /产品数据无效/,
    mutate(catalog) {
      unconnectedProduct(catalog).directoryKind = "invalid-directory";
    }
  },
  {
    name: "v1 product extensions in a resource catalog",
    pattern: /产品不能再包含扩展子目录/,
    mutate(catalog) {
      unconnectedProduct(catalog).extensions = [];
    }
  },
  {
    name: "Resource target with an unknown host",
    pattern: /资源目标配置无效/,
    mutate(catalog) {
      unconnectedResource(catalog).targets[0].productId = "unknown-parity-host";
    }
  }
];

function unconnectedProduct(catalog) {
  const connectedHostIds = new Set(
    composition().resourceConnections.map((connection) => connection.hostProductId)
  );
  return catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((product) => !connectedHostIds.has(product.id));
}

function unconnectedResource(catalog) {
  const connectedResourceIds = new Set(
    composition().resourceConnections.map((connection) => connection.resourceId)
  );
  return catalog.resources.find(
    (resource) => !connectedResourceIds.has(resource.id) && resource.targets.length > 0
  );
}

function assertV2V3Parity(validator, cases = parityCases) {
  for (const parityCase of cases) {
    for (const schemaVersion of [2, 3]) {
      const catalog = schemaVersion === 2
        ? structuredClone(composition().catalog)
        : catalogV3();
      parityCase.mutate(catalog);
      assert.throws(
        () => validator(catalog),
        parityCase.pattern,
        `${parityCase.name} must fail for schema v${schemaVersion}`
      );
    }
  }
}

function mutatedValidateCatalog(occurrence) {
  const filename = path.join(root, "shared/catalog.cjs");
  let seen = 0;
  const source = fs.readFileSync(filename, "utf8").replace(
    /inputSchemaVersion !== 1/g,
    (guard) => {
      seen += 1;
      return seen === occurrence ? "inputSchemaVersion === 2" : guard;
    }
  );
  assert.equal(seen, 4, "catalog v2/v3 shared guard count drift");
  const mutated = new Module(`${filename}?mutation=${occurrence}`, module);
  mutated.filename = filename;
  mutated.paths = Module._nodeModulePaths(path.dirname(filename));
  mutated._compile(source, filename);
  return mutated.exports.validateCatalog;
}

test("schema v2 rejects the v3 resourceConnections field", () => {
  const source = composition();
  assert.throws(
    () => validateCatalog({
      ...structuredClone(source.catalog),
      resourceConnections: structuredClone(source.resourceConnections)
    }),
    /目录结构无效/
  );
});

test("schema v3 requires resourceConnections and accepts the exact legal array", () => {
  const missing = structuredClone(composition().catalog);
  missing.schemaVersion = 3;
  assert.throws(() => validateCatalog(missing), /生态资源连接结构无效/);
  assert.throws(
    () => validateCatalog({ ...missing, resourceConnections: {} }),
    /生态资源连接结构无效/
  );

  const valid = catalogV3();
  assert.equal(validateCatalog(valid), valid);
});

test("schema v3 rejects invalid resource connection facts through validateCatalog", () => {
  const source = composition();
  const invalidCases = [
    {
      name: "mode-binding pair",
      pattern: /resource marketplace connection mode binding invalid/,
      mutate(connections) {
        connections[0].connectionMode = "chatgpt-app";
      }
    },
    {
      name: "unknown host",
      pattern: /resource marketplace connection host invalid/,
      mutate(connections) {
        connections[0].hostProductId = "unknown-host";
      }
    },
    {
      name: "unknown resource",
      pattern: /resource marketplace connection resource invalid/,
      mutate(connections) {
        connections[0].resourceId = "unknown-resource";
      }
    },
    {
      name: "duplicate edge",
      pattern: /resource marketplace duplicate connection/,
      mutate(connections) {
        connections.push(structuredClone(connections[0]));
      }
    }
  ];

  for (const invalidCase of invalidCases) {
    const connections = structuredClone(source.resourceConnections);
    invalidCase.mutate(connections);
    assert.throws(
      () => validateCatalog(catalogV3(connections)),
      invalidCase.pattern,
      invalidCase.name
    );
  }
});

test("existing schema v1 normalization and schema v2 validation do not drift", () => {
  const legacy = legacyCatalog();
  const normalized = validateCatalog(structuredClone(legacy));
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.vendors[0].products[0].directoryKind, "ai-tool");
  assert.deepEqual(normalized.resources, []);

  const v2 = structuredClone(composition().catalog);
  assert.equal(validateCatalog(v2), v2);
  assert.deepEqual(v2, composition().catalog);
});

test("schema v2 and v3 reject the same resource and product contract violations", () => {
  const validV3 = catalogV3();
  assert.equal(validateCatalog(validV3), validV3);
  assertV2V3Parity(validateCatalog);
});

test("parity seam kills every v3 shared-rule guard rollback", () => {
  for (const [occurrence, parityCase] of [
    [1, parityCases[0]],
    [2, parityCases[2]],
    [3, parityCases[3]],
    [4, parityCases[1]],
    [4, parityCases[4]]
  ]) {
    assert.throws(
      () => assertV2V3Parity(mutatedValidateCatalog(occurrence), [parityCase]),
      /must fail for schema v3/,
      `guard ${occurrence} mutation survived ${parityCase.name}`
    );
  }
});

test("active product and development catalog consumers accept catalog schema v3", async () => {
  const v3 = catalogV3();
  for (const schemaVersion of [1, 2, 3]) {
    const consumerCatalog = structuredClone(v3);
    consumerCatalog.schemaVersion = schemaVersion;
    if (schemaVersion !== 3) delete consumerCatalog.resourceConnections;
    assert.equal(
      new Set(enabledProductIdsFromCatalog(consumerCatalog)).has("chatgpt-desktop"),
      true
    );
  }
  assert.throws(
    () => enabledProductIdsFromCatalog({ ...v3, schemaVersion: 4 }),
    /active catalog response is invalid/
  );

  const projection = workflowDependencyProjection(v3);
  const firstConnection = v3.resourceConnections[0];
  assert.equal(
    projection.resourceBindings.has([
      firstConnection.resourceId,
      firstConnection.hostProductId,
      firstConnection.bindingKind
    ].join("\u0000")),
    false,
    "resourceConnections must not grant a Workflow dependency"
  );

  async function developmentResult(schemaVersion) {
    const catalog = structuredClone(v3);
    catalog.schemaVersion = schemaVersion;
    if (schemaVersion !== 3) delete catalog.resourceConnections;
    return loadDevelopmentCatalog(async () => ({
      ok: true,
      url: "http://127.0.0.1:5173/__aihub-local-catalog/catalog-release.json",
      async json() {
        return {
          schemaVersion: 1,
          kind: "catalog",
          payload: { catalogVersion: 8, catalog },
          signature: "candidate-only-test"
        };
      }
    }));
  }
  for (const schemaVersion of [1, 2, 3]) {
    const result = await developmentResult(schemaVersion);
    assert.equal(result.source, "remote");
    assert.equal(result.catalog.schemaVersion, schemaVersion);
  }
  assert.equal((await developmentResult(4)).source, "built-in");
  const malformedV3 = await loadDevelopmentCatalog(async () => ({
    ok: true,
    async json() {
      return {
        schemaVersion: 1,
        kind: "catalog",
        payload: {
          catalogVersion: 8,
          catalog: { schemaVersion: 3, vendors: [], resources: [] }
        },
        signature: "candidate-only-test"
      };
    }
  }));
  assert.equal(malformedV3.source, "built-in");
});

test("renderer DTO and connection fixture declare the catalog v3 boundary", () => {
  const types = fs.readFileSync(path.join(root, "src/vite-env.d.ts"), "utf8");
  const fixture = fs.readFileSync(
    path.join(root, "scripts/fixtures/installed-management-preview-preload.cjs"),
    "utf8"
  );
  assert.match(
    types,
    /schemaVersion: 3; resourceConnections: import\("\.\/data"\)\.ResourceConnection\[\]/
  );
  assert.match(
    fixture,
    /const catalog = \{\s*schemaVersion: 3,[\s\S]*?resourceConnections: \[/
  );
});

test("candidate-only catalog v3 moves the exact frozen edges into the catalog", () => {
  const absoluteCandidatePath = path.join(root, candidatePath);
  assert.equal(
    fs.existsSync(absoluteCandidatePath),
    true,
    "catalog v3 candidate artifact must exist"
  );

  const source = composition();
  const candidate = JSON.parse(fs.readFileSync(absoluteCandidatePath, "utf8"));
  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly",
    "catalog",
    "freezeOnly",
    "generatedAt",
    "input",
    "publishable",
    "safety",
    "schemaVersion",
    "summary",
    "targetRelease",
    "title"
  ]);
  assert.deepEqual(
    [candidate.schemaVersion, candidate.candidateOnly, candidate.freezeOnly, candidate.publishable],
    [1, true, true, false]
  );
  assert.equal(candidate.targetRelease, "next-major");
  assert.deepEqual(candidate.input, {
    path: compositionPath,
    sha256: compositionSha256
  });
  assert.equal(Object.hasOwn(candidate, "resourceConnections"), false);

  const expectedCatalog = structuredClone(source.catalog);
  expectedCatalog.schemaVersion = 3;
  expectedCatalog.resourceConnections = structuredClone(source.resourceConnections);
  assert.deepEqual(candidate.catalog, expectedCatalog);
  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  assert.deepEqual(candidate.summary, {
    resources: 262,
    targets: 796,
    resourceConnections: 10
  });

  const reversed = structuredClone(candidate.catalog);
  const edges = reversed.resourceConnections;
  delete reversed.resourceConnections;
  reversed.schemaVersion = 2;
  assert.deepEqual(reversed, source.catalog);
  assert.deepEqual(edges, source.resourceConnections);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    signed: false,
    activeCatalogWritten: false,
    stateWritten: false,
    channelWritten: false,
    packaged: false
  });
});
