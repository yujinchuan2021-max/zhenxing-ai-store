"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  catalogChannelStorage,
  normalizeCatalogHighWater,
  readCatalogClientChannel,
  recordCatalogHighWater
} = require("../shared/catalog-client-channel.cjs");

const { publicKey } = crypto.generateKeyPairSync("ed25519");
const trustedKeys = [{
  keyId: "catalog-test",
  publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64")
}];

function channel(catalogChannel, releaseUrl) {
  return {
    schemaVersion: 2,
    kind: "catalog",
    ...(catalogChannel ? { catalogChannel } : {}),
    releaseUrl,
    allowedReleaseOrigins: ["https://localhost:4443"],
    trustedKeys
  };
}

test("catalog channel is explicit, defaults to v1, and binds its release path", () => {
  assert.equal(
    readCatalogClientChannel(channel(undefined, "https://localhost:4443/catalog-release.json"), { kind: "catalog", allowLocalhost: true }).catalogChannel,
    "v1"
  );
  assert.equal(
    readCatalogClientChannel(channel("v2", "https://localhost:4443/channels/v2/catalog-release.json"), { kind: "catalog", allowLocalhost: true }).catalogChannel,
    "v2"
  );
  assert.throws(
    () => readCatalogClientChannel(channel("v2", "https://localhost:4443/catalog-release.json"), { kind: "catalog", allowLocalhost: true }),
    /explicit channel/
  );
});

test("cache and high water do not cross catalog channels", () => {
  assert.notDeepEqual(catalogChannelStorage("v1"), catalogChannelStorage("v2"));
  assert.deepEqual(normalizeCatalogHighWater(undefined), { schemaVersion: 1, catalogVersion: 0, catalogSha256: "" });
  assert.deepEqual(
    recordCatalogHighWater(undefined, { catalogVersion: 1, catalogSha256: "a".repeat(64) }),
    { schemaVersion: 1, catalogVersion: 1, catalogSha256: "a".repeat(64) }
  );
  assert.deepEqual(
    recordCatalogHighWater({ schemaVersion: 1, catalogVersion: 72, catalogSha256: "b".repeat(64) }, { catalogVersion: 1, catalogSha256: "a".repeat(64) }),
    { schemaVersion: 1, catalogVersion: 72, catalogSha256: "b".repeat(64) }
  );
  assert.doesNotThrow(() =>
    recordCatalogHighWater(
      normalizeCatalogHighWater({
        schemaVersion: 1,
        catalogVersion: 1,
        catalogSha256: "a".repeat(64)
      }),
      { catalogVersion: 2, catalogSha256: "b".repeat(64) }
    )
  );
});

test("the v2 build embeds an explicit v2 channel and preserves safe 404 fallback", () => {
  const root = path.resolve(__dirname, "..");
  const config = JSON.parse(fs.readFileSync(path.join(root, "catalog", "channel.local-v2.json"), "utf8"));
  const builder = fs.readFileSync(path.join(root, "electron-builder.local-release.cjs"), "utf8");
  const reviewPackager = fs.readFileSync(path.join(root, "scripts", "package-review-release.cjs"), "utf8");
  const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.equal(config.catalogChannel, "v2");
  assert.equal(config.releaseUrl, "https://localhost:4443/channels/v2/catalog-release.json");
  assert.match(builder, /AIHUB_CATALOG_CHANNEL/);
  assert.match(reviewPackager, /AIHUB_LOCAL_RELEASE_BASE_VERSION/);
  assert.match(main, /catalogCachePath\(channel\.catalogChannel\)/);
  assert.match(main, /readCatalogHighWater\(channel\.catalogChannel\)/);
  assert.match(main, /return normalizeCatalogHighWater\(\);/);
  assert.match(main, /writeCatalogHighWater\(channel\.catalogChannel, result\.release\)/);
  assert.match(main, /resolvePackagedCatalogFallback\(\{ cached, error: remoteError \}\)/);
  const catalogFetch = main.slice(
    main.indexOf("async function fetchRemoteCatalogRelease"),
    main.indexOf("function readCachedCatalogRelease")
  );
  assert.doesNotMatch(catalogFetch, /user-agent/i);
});

test("catalog resolution shares one in-flight remote load across concurrent callers", () => {
  const main = fs.readFileSync(path.join(path.resolve(__dirname, ".."), "electron", "main.cjs"), "utf8");
  assert.match(main, /let catalogResolveInFlight = null/);
  assert.ok(main.includes("function resolveCatalog() {"));
  assert.ok(main.includes("if (catalogResolveInFlight) return catalogResolveInFlight;"));
  assert.ok(main.includes("catalogResolveInFlight = loadCatalogUnshared();"));
  assert.ok(main.includes("catalogResolveInFlight.finally(() => {"));
  assert.ok(main.includes("catalogResolveInFlight = null"));
});

test("concurrent catalog callers perform one load and a later call retries after settlement", async () => {
  const main = fs.readFileSync(path.join(path.resolve(__dirname, ".."), "electron", "main.cjs"), "utf8");
  const start = main.indexOf("let catalogResolveInFlight = null;");
  const end = main.indexOf("function authorizeCurrentCatalogProduct", start);
  const sandbox = { calls: 0, release: null, Promise };
  vm.runInNewContext(
    "function loadCatalogUnshared() {" +
      "calls += 1;" +
      "return new Promise(resolve => { release = () => resolve({ calls }); });" +
    "}" +
    main.slice(start, end),
    sandbox
  );
  const first = vm.runInNewContext("resolveCatalog()", sandbox);
  const second = vm.runInNewContext("resolveCatalog()", sandbox);
  const third = vm.runInNewContext("resolveCatalog()", sandbox);
  assert.equal(sandbox.calls, 1);
  sandbox.release();
  await Promise.all([first, second, third]);
  vm.runInNewContext("resolveCatalog()", sandbox);
  assert.equal(sandbox.calls, 2);
});

test("the 0.1.41 local build selects v2 only through explicit configuration", () => {
  const root = path.resolve(__dirname, "..");
  const probe = spawnSync(process.execPath, ["-e", `
    const config = require(${JSON.stringify(path.join(root, "electron-builder.local-release.cjs"))});
    const catalog = config.extraResources.find((entry) => entry.to === "catalog/channel.json");
    process.stdout.write(JSON.stringify({ version: config.extraMetadata.version, catalog: require(catalog.from) }));
  `], {
    env: { ...process.env, AIHUB_CATALOG_CHANNEL: "v2", AIHUB_LOCAL_RELEASE_BASE_VERSION: "0.1.41" },
    encoding: "utf8"
  });
  assert.equal(probe.status, 0, probe.stderr);
  const selected = JSON.parse(probe.stdout);
  assert.equal(selected.version, "0.1.41");
  assert.equal(selected.catalog.catalogChannel, "v2");
});
