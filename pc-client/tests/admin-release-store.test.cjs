"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createReleaseStore } = require("../admin/release-store.cjs");
const {
  validateCatalogReleasePayload
} = require("../shared/catalog-release.cjs");
const {
  verifySignedEnvelope
} = require("../shared/signed-release.cjs");

function validCatalog(title = "初始目录") {
  return {
    schemaVersion: 1,
    brand: { name: "AI Hub", mark: "A", slogan: title },
    home: {
      banners: [
        {
          eyebrow: "AI HUB",
          title,
          description: "目录发布存储测试。",
          action: "查看厂商"
        }
      ],
      featuredVendorIds: ["example"]
    },
    vendors: [
      {
        id: "example",
        name: "Example",
        initial: "E",
        mark: "E",
        color: "#112233",
        description: "示例厂商。",
        website: "https://example.com",
        tutorial: "https://example.com/docs",
        products: [
          {
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
          }
        ]
      }
    ]
  };
}

function fixture(t) {
  const rootDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-release-store-")
  );
  t.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  let tick = Date.parse("2026-07-30T12:00:00.000Z");
  const store = createReleaseStore({
    rootDirectory,
    clock: () => {
      tick += 1000;
      return tick;
    },
    signingKeyProvider: async () => ({
      keyId: "test-release-key",
      privateKey
    })
  });
  const trustedKeys = [
    {
      keyId: "test-release-key",
      publicKey: publicKey
        .export({ type: "spki", format: "der" })
        .toString("base64")
    }
  ];
  return { rootDirectory, store, privateKey, trustedKeys };
}

test("saves revisioned drafts and rejects stale writers", async (t) => {
  const { store } = fixture(t);
  assert.deepEqual(await store.readState(), {
    schemaVersion: 1,
    draft: null,
    activeRelease: null,
    activeCatalogVersion: 0
  });
  const first = await store.saveDraft({
    catalog: validCatalog(),
    expectedRevision: 0
  });
  assert.equal(first.revision, 1);
  assert.equal(first.catalog.updatedAt, first.updatedAt);
  assert.equal((await store.readState()).draft.catalog.updatedAt, first.updatedAt);
  await assert.rejects(
    store.saveDraft({
      catalog: validCatalog("陈旧写入"),
      expectedRevision: 0
    }),
    /版本冲突/
  );
  const second = await store.saveDraft({
    catalog: validCatalog("第二版草稿"),
    expectedRevision: 1
  });
  assert.equal(second.revision, 2);
  assert.equal((await store.readState()).draft.catalog.brand.slogan, "第二版草稿");
});

test("an exact-revision save can replace a draft rejected by a newer policy", async (t) => {
  const { rootDirectory, store } = fixture(t);
  await store.saveDraft({
    catalog: validCatalog("旧策略草稿"),
    expectedRevision: 0
  });
  const statePath = path.join(rootDirectory, "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.draft.catalog.vendors[0].products[0].download = {
    url: "https://example.com/unreviewed.exe",
    fileName: "unreviewed.exe"
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  await assert.rejects(store.readState(), /托管安装包|非托管产品/);
  const repaired = await store.saveDraft({
    catalog: validCatalog("新策略草稿"),
    expectedRevision: 1
  });
  assert.equal(repaired.revision, 2);
  assert.equal(
    (await store.readState()).draft.catalog.brand.slogan,
    "新策略草稿"
  );
});

test("publishes immutable signed releases and preserves history", async (t) => {
  const { rootDirectory, store, trustedKeys } = fixture(t);
  await store.saveDraft({ catalog: validCatalog("版本一"), expectedRevision: 0 });
  const first = await store.publish({
    expectedDraftRevision: 1,
    expectedActiveCatalogVersion: 0,
    notes: "首次发布"
  });
  assert.equal(first.release.catalogVersion, 1);
  const verifiedPayload = verifySignedEnvelope(first.envelope, {
      kind: "catalog",
      trustedKeys
    });
  assert.equal(verifiedPayload.catalog.brand.slogan, "版本一");
  assert.equal(
    validateCatalogReleasePayload(verifiedPayload).catalogVersion,
    1
  );
  const firstPath = path.join(
    rootDirectory,
    "releases",
    first.release.fileName
  );
  const firstRaw = fs.readFileSync(firstPath, "utf8");

  await store.saveDraft({ catalog: validCatalog("版本二"), expectedRevision: 1 });
  const second = await store.publish({
    expectedDraftRevision: 2,
    expectedActiveCatalogVersion: 1,
    notes: "第二次发布",
    rollout: { percentage: 25, salt: "release-two" }
  });
  assert.equal(second.release.catalogVersion, 2);
  assert.equal(fs.readFileSync(firstPath, "utf8"), firstRaw);
  assert.deepEqual(
    (await store.listHistory()).map((entry) => entry.catalogVersion),
    [2, 1]
  );
  const state = await store.readState();
  assert.equal(state.activeRelease.releaseId, second.release.releaseId);
  assert.equal(state.activeCatalogVersion, 2);
});

test("rollback creates a higher signed catalog version", async (t) => {
  const { store, trustedKeys } = fixture(t);
  await store.saveDraft({ catalog: validCatalog("版本一"), expectedRevision: 0 });
  const first = await store.publish({
    expectedDraftRevision: 1,
    expectedActiveCatalogVersion: 0
  });
  await store.saveDraft({ catalog: validCatalog("版本二"), expectedRevision: 1 });
  const second = await store.publish({
    expectedDraftRevision: 2,
    expectedActiveCatalogVersion: 1
  });
  const rolledBack = await store.rollback({
    releaseId: first.release.releaseId,
    expectedActiveCatalogVersion: 2,
    notes: "恢复版本一"
  });
  const payload = verifySignedEnvelope(rolledBack.envelope, {
    kind: "catalog",
    trustedKeys
  });
  assert.equal(payload.catalogVersion, 3);
  assert.equal(payload.catalog.brand.slogan, "版本一");
  assert.equal(payload.parentReleaseId, second.release.releaseId);
  assert.equal(payload.sourceReleaseId, first.release.releaseId);
  assert.equal(rolledBack.release.parentReleaseId, second.release.releaseId);
  assert.equal(rolledBack.release.sourceReleaseId, first.release.releaseId);
  assert.equal((await store.readState()).activeCatalogVersion, 3);
});

test("v2 channel migrates legacy state and isolates signed history, pointers, and rollback", async (t) => {
  const { rootDirectory, store, trustedKeys } = fixture(t);
  await store.saveDraft({ catalog: validCatalog("v1"), expectedRevision: 0 });
  const v1 = await store.publish({ channel: "v1", expectedDraftRevision: 1, expectedActiveCatalogVersion: 0 });
  const statePath = path.join(rootDirectory, "state.json");
  const legacy = JSON.parse(fs.readFileSync(statePath, "utf8"));
  delete legacy.channels;
  fs.writeFileSync(statePath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  assert.equal((await store.readState()).activeRelease.releaseId, v1.release.releaseId);
  assert.equal((await store.readChannel("v2")).activeRelease, null);

  await store.saveDraft({ catalog: validCatalog("v2"), expectedRevision: 1 });
  const v2 = await store.publish({ channel: "v2", expectedDraftRevision: 2, expectedActiveCatalogVersion: 0 });
  assert.equal(v2.release.catalogVersion, 1);
  assert.equal(verifySignedEnvelope(v2.envelope, { kind: "catalog", trustedKeys }).catalog.brand.slogan, "v2");
  assert.equal((await store.readState()).activeRelease.releaseId, v1.release.releaseId);
  assert.equal((await store.readChannel("v2")).activeRelease.releaseId, v2.release.releaseId);
  assert.deepEqual((await store.listHistory()).map((entry) => entry.releaseId), [v1.release.releaseId]);
  assert.deepEqual((await store.listHistory({ channel: "v2" })).map((entry) => entry.releaseId), [v2.release.releaseId]);
  await assert.rejects(store.readRelease(v1.release.releaseId, { channel: "v2" }), /不存在/);
  await assert.rejects(store.rollback({ channel: "v2", releaseId: v1.release.releaseId, expectedActiveCatalogVersion: 1 }), /不存在/);
});

test("v2 signs the carousel candidate while v1 refuses to overwrite compatible active semantics", async (t) => {
  const { store, trustedKeys } = fixture(t);
  const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../admin/data/catalog-v1.json"), "utf8"));
  catalog.homeCarousel = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../docs/home-carousel-draft83-candidate.json"), "utf8")).homeCarousel;
  await store.saveDraft({ catalog, expectedRevision: 0 });
  await assert.rejects(store.publish({ channel: "v1", expectedDraftRevision: 1, expectedActiveCatalogVersion: 0 }), /v1 catalog channel/);
  const v2 = await store.publish({ channel: "v2", expectedDraftRevision: 1, expectedActiveCatalogVersion: 0 });
  assert.equal(verifySignedEnvelope(v2.envelope, { kind: "catalog", trustedKeys }).catalog.homeCarousel.slides.length, 3);
  assert.equal((await store.readState()).activeCatalogVersion, 0);
  assert.equal((await store.readChannel("v2")).activeCatalogVersion, 1);
});

test("a failed signing provider does not switch the active release", async (t) => {
  const rootDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-release-sign-failure-")
  );
  t.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
  const store = createReleaseStore({
    rootDirectory,
    clock: () => "2026-07-30T12:00:00.000Z",
    signingKeyProvider: async () => {
      throw new Error("签名服务不可用");
    }
  });
  await store.saveDraft({ catalog: validCatalog(), expectedRevision: 0 });
  await assert.rejects(
    store.publish({
      expectedDraftRevision: 1,
      expectedActiveCatalogVersion: 0
    }),
    /签名服务不可用/
  );
  const state = await store.readState();
  assert.equal(state.activeRelease, null);
  assert.equal(state.activeCatalogVersion, 0);
  assert.deepEqual(await store.listHistory(), []);
});

test("an atomic pointer failure leaves the previous active release intact", async (t) => {
  const { rootDirectory, store } = fixture(t);
  await store.saveDraft({ catalog: validCatalog("版本一"), expectedRevision: 0 });
  const first = await store.publish({
    expectedDraftRevision: 1,
    expectedActiveCatalogVersion: 0
  });
  await store.saveDraft({ catalog: validCatalog("版本二"), expectedRevision: 1 });

  const originalRename = fs.renameSync;
  fs.renameSync = (source, destination) => {
    if (destination === path.join(rootDirectory, "state.json")) {
      throw new Error("模拟活动指针写入失败");
    }
    return originalRename(source, destination);
  };
  try {
    await assert.rejects(
      store.publish({
        expectedDraftRevision: 2,
        expectedActiveCatalogVersion: 1
      }),
      /模拟活动指针写入失败/
    );
  } finally {
    fs.renameSync = originalRename;
  }
  const state = await store.readState();
  assert.equal(state.activeRelease.releaseId, first.release.releaseId);
  assert.equal(state.activeCatalogVersion, 1);
  assert.deepEqual(
    (await store.listHistory()).map((entry) => entry.catalogVersion),
    [1]
  );
  const retried = await store.publish({
    expectedDraftRevision: 2,
    expectedActiveCatalogVersion: 1
  });
  assert.equal(retried.release.catalogVersion, 2);
  assert.equal((await store.readState()).activeCatalogVersion, 2);
});

test("private signing material is never returned or persisted", async (t) => {
  const { rootDirectory, store, privateKey } = fixture(t);
  await store.saveDraft({ catalog: validCatalog(), expectedRevision: 0 });
  const result = await store.publish({
    expectedDraftRevision: 1,
    expectedActiveCatalogVersion: 0
  });
  const privatePem = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  assert.doesNotMatch(JSON.stringify(result), /privateKey|PRIVATE KEY/);
  const persisted = fs
    .readdirSync(rootDirectory, { recursive: true })
    .filter((entry) => fs.statSync(path.join(rootDirectory, entry)).isFile())
    .map((entry) => fs.readFileSync(path.join(rootDirectory, entry), "utf8"))
    .join("\n");
  assert.equal(persisted.includes(privatePem.trim()), false);
  assert.doesNotMatch(persisted, /PRIVATE KEY/);
});
