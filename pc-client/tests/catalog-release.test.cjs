"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  catalogReleaseSha256,
  validateCatalogReleasePayload,
  verifyCatalogReleaseIntegrity,
  verifyCatalogRelease,
  verifyCatalogReleaseCache
} = require("../shared/catalog-release.cjs");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");

function keys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    privateKey,
    trustedKeys: [
      {
        keyId: "catalog-test-2026",
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

function catalog() {
  return {
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
}

function payload(overrides = {}) {
  const value = catalog();
  return {
    schemaVersion: 1,
    releaseId: "catalog-v00000003-0123456789ab-01234567",
    catalogVersion: 3,
    publishedAt: "2026-07-30T00:00:00.000Z",
    draftRevision: 2,
    parentReleaseId: "catalog-v00000002-0123456789ab-01234567",
    sourceReleaseId: null,
    notes: "测试发布",
    rollout: { percentage: 100, salt: "catalog-release-salt" },
    catalogSha256: catalogReleaseSha256(value),
    catalog: value,
    ...overrides
  };
}

function signed(keyFixture, overrides = {}) {
  return createSignedEnvelope({
    kind: "catalog",
    keyId: "catalog-test-2026",
    payload: payload(overrides),
    privateKey: keyFixture.privateKey
  });
}

test("verifies a signed catalog release and makes rollout stable per client", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture, {
    rollout: { percentage: 50, salt: "catalog-release-salt" }
  });
  const options = {
    trustedKeys: keyFixture.trustedKeys,
    clientId: "client-catalog-1234"
  };
  const first = verifyCatalogRelease(envelope, options);
  const second = verifyCatalogRelease(envelope, options);

  assert.equal(first.catalogVersion, 3);
  assert.equal(first.catalogSha256, envelope.payload.catalogSha256);
  assert.equal(first.catalog.schemaVersion, 2);
  assert.equal(first.eligible, second.eligible);
  assert.equal(first.highestCatalogVersion, 3);
});

test("enforces exact release fields, positive versions, canonical time, and rollout", () => {
  const valid = payload();
  for (const invalid of [
    { ...valid, extra: true },
    { ...valid, catalogVersion: 0 },
    { ...valid, catalogVersion: 1.5 },
    { ...valid, publishedAt: "2026-07-30T00:00:00Z" },
    { ...valid, rollout: { ...valid.rollout, cohort: "extra" } },
    { ...valid, rollout: { percentage: 101, salt: "catalog-release-salt" } },
    { ...valid, catalogSha256: valid.catalogSha256.toUpperCase() }
  ]) {
    assert.throws(
      () => validateCatalogReleasePayload(invalid),
      /目录|灰度/
    );
  }
});

test("rejects catalog digest mismatch and an invalid catalog", () => {
  const valid = payload();
  assert.throws(
    () =>
      validateCatalogReleasePayload({
        ...valid,
        catalogSha256: "0".repeat(64)
      }),
    /摘要/
  );
  const invalidCatalog = { schemaVersion: 1, vendors: [] };
  assert.throws(
    () =>
      validateCatalogReleasePayload({
        ...valid,
        catalog: invalidCatalog,
        catalogSha256: catalogReleaseSha256(invalidCatalog)
      }),
    /目录/
  );
});

test("integrity-only verification can archive a signed legacy policy release", () => {
  const keyFixture = keys();
  const legacyCatalog = catalog();
  legacyCatalog.vendors[0].products[0].download = {
    url: "https://example.com/legacy.exe",
    fileName: "legacy.exe"
  };
  const envelope = signed(keyFixture, {
    catalog: legacyCatalog,
    catalogSha256: catalogReleaseSha256(legacyCatalog)
  });
  assert.throws(
    () =>
      verifyCatalogRelease(envelope, {
        trustedKeys: keyFixture.trustedKeys,
        clientId: "client-catalog-1234"
      }),
    /目录|托管安装包/
  );
  assert.equal(
    verifyCatalogReleaseIntegrity(envelope, {
      trustedKeys: keyFixture.trustedKeys
    }).catalogVersion,
    3
  );
});

test("verifies the envelope before accepting catalog content", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture);
  assert.throws(
    () =>
      verifyCatalogRelease(
        {
          ...envelope,
          payload: { ...envelope.payload, catalogVersion: 4 }
        },
        {
          trustedKeys: keyFixture.trustedKeys,
          clientId: "client-catalog-1234"
        }
      ),
    /签名/
  );
});

test("rejects rollback below the highest accepted catalog version", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture);
  assert.throws(
    () =>
      verifyCatalogRelease(envelope, {
        trustedKeys: keyFixture.trustedKeys,
        clientId: "client-catalog-1234",
        highestCatalogVersion: 4
      }),
    /最高版本/
  );
  assert.equal(
    verifyCatalogRelease(envelope, {
      trustedKeys: keyFixture.trustedKeys,
      clientId: "client-catalog-1234",
      highestCatalogVersion: 3,
      highestCatalogSha256: envelope.payload.catalogSha256
    }).catalogVersion,
    3
  );
});

test("rejects equivocation for the same accepted catalog version", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture);
  assert.throws(
    () =>
      verifyCatalogRelease(envelope, {
        trustedKeys: keyFixture.trustedKeys,
        clientId: "client-catalog-1234",
        highestCatalogVersion: 3,
        highestCatalogSha256: "f".repeat(64)
      }),
    /同一目录版本/
  );
});

test("reverifies cached signatures and binds cache to the exact source", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture);
  const cache = {
    schemaVersion: 1,
    sourceUrl: "https://catalog.example/releases/catalog-v1.json",
    cachedAt: "2026-07-30T01:00:00.000Z",
    envelope
  };
  const options = {
    expectedSourceUrl: cache.sourceUrl,
    trustedKeys: keyFixture.trustedKeys,
    clientId: "client-catalog-1234"
  };

  assert.equal(verifyCatalogReleaseCache(cache, options).catalogVersion, 3);
  assert.throws(
    () =>
      verifyCatalogReleaseCache(cache, {
        ...options,
        expectedSourceUrl: "https://other.example/releases/catalog-v1.json"
      }),
    /来源/
  );
  assert.throws(
    () =>
      verifyCatalogReleaseCache(
        {
          ...cache,
          envelope: {
            ...envelope,
            signature: Buffer.alloc(64, 1).toString("base64")
          }
        },
        options
      ),
    /签名/
  );
});

test("requires strict canonical cache metadata and valid chronology", () => {
  const keyFixture = keys();
  const envelope = signed(keyFixture);
  const base = {
    schemaVersion: 1,
    sourceUrl: "https://catalog.example/releases/catalog-v1.json",
    cachedAt: "2026-07-30T01:00:00.000Z",
    envelope
  };
  const options = {
    expectedSourceUrl: base.sourceUrl,
    trustedKeys: keyFixture.trustedKeys,
    clientId: "client-catalog-1234"
  };
  for (const invalid of [
    { ...base, extra: true },
    { ...base, sourceUrl: "https://user@catalog.example/catalog.json" },
    { ...base, sourceUrl: "https://catalog.example/catalog.json#fragment" },
    { ...base, cachedAt: "2026-07-30T01:00:00Z" },
    { ...base, cachedAt: "2026-07-29T23:59:59.000Z" }
  ]) {
    assert.throws(
      () => verifyCatalogReleaseCache(invalid, options),
      /缓存|来源|时间/
    );
  }
});
