"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createActiveCatalogProductSource,
  normalizeCatalogUrl
} = require("../shared/active-catalog-products.cjs");
const {
  catalogReleaseSha256
} = require("../shared/catalog-release.cjs");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");

function response(value, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return structuredClone(value);
    }
  };
}

function signedCatalogRelease(catalogVersion, keyFixture, catalogSha256 = "") {
  const catalog = {
    schemaVersion: 1,
    vendors: [
      {
        id: "example",
        name: "Example",
        initial: "E",
        mark: "E",
        color: "#123456",
        description: "示例厂商",
        website: "https://example.com",
        tutorial: "https://example.com/docs",
        products: [
          {
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
          }
        ]
      }
    ]
  };
  return createSignedEnvelope({
    kind: "catalog",
    keyId: keyFixture.keyId,
    privateKey: keyFixture.privateKey,
    payload: {
      schemaVersion: 1,
      releaseId: `catalog-v${String(catalogVersion).padStart(8, "0")}-0123456789ab-01234567`,
      catalogVersion,
      publishedAt: "2026-08-06T00:00:00.000Z",
      draftRevision: 89,
      parentReleaseId: null,
      sourceReleaseId: null,
      notes: "identity source fixture",
      rollout: { percentage: 100, salt: "identity-source-fixture" },
      catalogSha256: catalogSha256 || catalogReleaseSha256(catalog),
      catalog
    }
  });
}

function signingKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const keyId = "catalog-identity-test";
  return {
    keyId,
    privateKey,
    trustedKeys: [
      {
        keyId,
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

test("identity product discussions use enabled products from the backend active catalog and cache a successful read", async () => {
  let requests = 0;
  let now = 1_000;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://127.0.0.1:4173/catalog-v1.json",
    cacheTtlMs: 5_000,
    now: () => now,
    fetchCatalog: async (url) => {
      requests += 1;
      assert.equal(url, "http://127.0.0.1:4173/catalog-v1.json");
      return response({
        schemaVersion: 1,
        vendors: [
          {
            id: "enabled-vendor",
            enabled: true,
            products: [
              { id: "enabled-product", enabled: true },
              { id: "disabled-product", enabled: false }
            ]
          },
          {
            id: "disabled-vendor",
            enabled: false,
            products: [{ id: "hidden-by-vendor", enabled: true }]
          }
        ]
      });
    }
  });

  assert.deepEqual(
    [...(await source.enabledProductIds())],
    ["enabled-product"]
  );
  now += 4_999;
  assert.deepEqual(
    [...(await source.enabledProductIds())],
    ["enabled-product"]
  );
  assert.equal(requests, 1);
});

test("cold catalog readiness shares one verified projection and clears failed in-flight loads", async () => {
  let requests = 0;
  let available = true;
  let releaseFetch;
  const blocked = new Promise((resolve) => { releaseFetch = resolve; });
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://127.0.0.1:4173/catalog-v1.json",
    fetchCatalog: async () => {
      requests += 1;
      if (!available) throw new Error("network unavailable");
      await blocked;
      return response({
        schemaVersion: 1,
        vendors: [{ id: "vendor", enabled: true, products: [{ id: "cold-product", enabled: true }] }]
      });
    }
  });

  assert.deepEqual(source.readiness(), { ready: false, status: "cold" });
  const warm = source.warm();
  const concurrent = [
    source.enabledProductIds(),
    source.hasCanonicalDependency({ kind: "product", canonicalId: "cold-product" }),
    source.hasCanonicalDependency({ kind: "product", canonicalId: "missing" })
  ];
  assert.deepEqual(source.readiness(), { ready: false, status: "loading" });
  assert.equal(requests, 1);
  releaseFetch();
  assert.equal(await warm, true);
  assert.deepEqual(await Promise.all(concurrent), [new Set(["cold-product"]), true, false]);
  assert.deepEqual(source.readiness(), { ready: true, status: "ready" });
  assert.equal(requests, 1);

  available = false;
  const failed = createActiveCatalogProductSource({
    catalogUrl: "http://127.0.0.1:4173/catalog-v1.json",
    fetchCatalog: async () => {
      requests += 1;
      if (!available) throw new Error("network unavailable");
      return response({ schemaVersion: 1, vendors: [] });
    }
  });
  await assert.rejects(
    () => failed.warm(),
    (error) => error.code === "TEMPORARILY_UNAVAILABLE" && error.status === 503
  );
  assert.deepEqual(failed.readiness(), { ready: false, status: "unavailable" });
  available = true;
  assert.equal(await failed.warm(), true);
  assert.deepEqual(failed.readiness(), { ready: true, status: "ready" });
});

test("workflow dependency lookup uses exact product and reviewed resource binding tuples from the same catalog read", async () => {
  let requests = 0;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://127.0.0.1:4173/catalog-v1.json",
    fetchCatalog: async () => {
      requests += 1;
      return response({
        schemaVersion: 2,
        vendors: [{ id: "vendor", enabled: true, products: [{ id: "host-product", enabled: true }] }],
        resourceStores: [{ id: "skill", enabled: true }],
        resources: [{
          id: "reviewed-skill",
          resourceTypes: ["skill"],
          sourceKind: "official",
          reviewStatus: "manually-reviewed",
          riskLevel: "low",
          enabled: true,
          targets: [{
            productId: "host-product",
            moduleId: "skill-managed",
            installProfileId: "reviewed-skill-profile",
            capabilities: ["install"],
            agentBindingKinds: ["skill-context"],
            enabled: true
          }]
        }, {
          id: "unreviewed-skill",
          resourceTypes: ["skill"],
          sourceKind: "community",
          reviewStatus: "unreviewed",
          riskLevel: "guarded",
          enabled: true,
          targets: [{
            productId: "host-product",
            moduleId: "skill-managed",
            installProfileId: "unreviewed-skill-profile",
            capabilities: ["install"],
            agentBindingKinds: ["skill-context"],
            enabled: true
          }]
        }]
      });
    }
  });

  assert.equal(await source.hasCanonicalDependency({ kind: "product", canonicalId: "host-product" }), true);
  assert.equal(await source.hasCanonicalDependency({
    kind: "resource",
    canonicalId: "reviewed-skill",
    hostProductId: "host-product",
    bindingKind: "skill-context"
  }), true);
  assert.equal(await source.hasCanonicalDependency({
    kind: "resource",
    canonicalId: "reviewed-skill",
    hostProductId: "host-product",
    bindingKind: "mcp-tool"
  }), false);
  assert.equal(await source.hasCanonicalDependency({
    kind: "resource",
    canonicalId: "unreviewed-skill",
    hostProductId: "host-product",
    bindingKind: "skill-context"
  }), false);
  assert.equal(await source.hasCanonicalDependency({ kind: "product", canonicalId: "missing" }), false);
  assert.equal(requests, 1);
});

test("identity product discussions fail closed instead of using a stale catalog when the backend is unavailable", async () => {
  let now = 1_000;
  let available = true;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://127.0.0.1:4173/catalog-v1.json",
    cacheTtlMs: 5_000,
    now: () => now,
    fetchCatalog: async () => {
      if (!available) throw new Error("admin unavailable");
      return response({
        schemaVersion: 1,
        vendors: [
          {
            id: "vendor",
            enabled: true,
            products: [{ id: "previously-enabled", enabled: true }]
          }
        ]
      });
    }
  });

  assert.equal((await source.enabledProductIds()).has("previously-enabled"), true);
  available = false;
  now += 5_001;
  await assert.rejects(
    () => source.enabledProductIds(),
    /active catalog is unavailable/
  );
});

test("identity accepts only the exact signed internal Admin release seam and enforces its high water", async () => {
  const keys = signingKeys();
  let envelope = signedCatalogRelease(72, keys);
  let now = 1_000;
  const source = createActiveCatalogProductSource({
    catalogUrl: "http://admin:4173/catalog-release.json",
    sourceMode: "signed-internal-admin",
    trustedKeys: keys.trustedKeys,
    highestCatalogVersion: 71,
    cacheTtlMs: 1_000,
    now: () => now,
    fetchCatalog: async (url) => {
      assert.equal(url, "http://admin:4173/catalog-release.json");
      return response(envelope);
    }
  });

  assert.deepEqual([...(await source.enabledProductIds())], ["example-web"]);
  envelope = signedCatalogRelease(73, keys);
  envelope.signature = `${envelope.signature.slice(0, -4)}AAAA`;
  now += 1_001;
  await assert.rejects(() => source.enabledProductIds(), /active catalog is unavailable/);
  envelope = signedCatalogRelease(73, keys);
  now += 1_001;
  assert.deepEqual([...(await source.enabledProductIds())], ["example-web"]);
  envelope = signedCatalogRelease(72, keys);
  now += 1_001;
  await assert.rejects(() => source.enabledProductIds(), /active catalog is unavailable/);
});

test("identity internal Admin trust is explicit and rejects every near-match", () => {
  assert.throws(
    () => normalizeCatalogUrl("http://admin:4173/catalog-release.json"),
    /fixed local admin endpoint/
  );
  assert.equal(
    normalizeCatalogUrl("http://admin:4173/catalog-release.json", {
      sourceMode: "signed-internal-admin"
    }),
    "http://admin:4173/catalog-release.json"
  );
  for (const value of [
    "http://admin:4174/catalog-release.json",
    "http://admin:4173/catalog-v1.json",
    "http://admin:4173/channels/v2/catalog-release.json",
    "http://admin:4173/catalog-release.json?channel=v1",
    "http://admin.example:4173/catalog-release.json",
    "http://user:pass@admin:4173/catalog-release.json"
  ]) {
    assert.throws(
      () => normalizeCatalogUrl(value, { sourceMode: "signed-internal-admin" }),
      /fixed local admin endpoint/
    );
  }
});

test("identity uses the active admin URL while retaining one exact file contract for rollback", () => {
  const compose = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/compose.yaml"),
    "utf8"
  );
  const server = fs.readFileSync(
    path.resolve(__dirname, "../identity/server.cjs"),
    "utf8"
  );

  assert.match(
    compose,
    /identity-community:[\s\S]*?AIHUB_CATALOG_URL: http:\/\/admin:4173\/catalog-release\.json/
  );
  assert.match(
    compose,
    /identity-community:[\s\S]*?AIHUB_CATALOG_SOURCE_MODE: signed-internal-admin/
  );
  assert.match(
    compose,
    /identity-community:[\s\S]*?depends_on:[\s\S]*?admin:[\s\S]*?condition: service_healthy/
  );
  assert.match(
    compose,
    /identity-community:[\s\S]*?AIHUB_CATALOG_FILE: \/app\/catalog\/catalog-v1\.json/
  );
  assert.match(compose, /\.\.\/\.\.\/admin\/data:\/app\/catalog:ro/);
  assert.doesNotMatch(compose, /admin\/published:\/app\/catalog/);
  assert.doesNotMatch(server, /admin["'],\s*["']published/);
  assert.doesNotMatch(server, /AIHUB_CATALOG_FILE/);
});
