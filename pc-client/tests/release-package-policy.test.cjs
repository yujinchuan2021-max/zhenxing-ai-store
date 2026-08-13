"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createReleaseStore } = require("../admin/release-store.cjs");
const packageJson = require("../package.json");
const localReleaseConfig = require("../electron-builder.local-release.cjs");
const {
  assertReleasePackageReady
} = require("../shared/release-package-policy.cjs");

const root = path.resolve(__dirname, "..");

function channelFromResources(extraResources, destination) {
  const resource = extraResources.find((entry) => entry.to === destination);
  assert.ok(resource, `missing ${destination}`);
  const source = path.isAbsolute(resource.from)
    ? resource.from
    : path.join(root, resource.from);
  return JSON.parse(fs.readFileSync(source, "utf8"));
}

function localChannel(kind) {
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    schemaVersion: 2,
    kind,
    releaseUrl: `https://localhost:4443/${kind}-release.json`,
    allowedReleaseOrigins: ["https://localhost:4443"],
    trustedKeys: [
      {
        keyId: `${kind}-local-test`,
        publicKey: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64")
      }
    ]
  };
}

function productionChannel(kind) {
  const channel = localChannel(kind);
  return {
    ...channel,
    releaseUrl: `https://releases.example.com/${kind}-release.json`,
    allowedReleaseOrigins: ["https://releases.example.com"]
  };
}

function v2Channel(trustedKeys) {
  return {
    ...localChannel("catalog"),
    catalogChannel: "v2",
    releaseUrl: "https://localhost:4443/channels/v2/catalog-release.json",
    trustedKeys
  };
}

function catalogFixture() {
  return JSON.parse(
    fs.readFileSync(path.join(root, "admin", "data", "catalog-v1.json"), "utf8")
  );
}

const localClientServices = {
  schemaVersion: 1,
  identityOrigin: "http://127.0.0.1:4180",
  communityOrigin: "http://127.0.0.1:8088"
};

test("production packaging is blocked while its server channels are disabled", () => {
  assert.throws(
    () =>
      assertReleasePackageReady({
        variant: "production",
        catalogChannel: channelFromResources(
          packageJson.build.extraResources,
          "catalog/channel.json"
        ),
        updateChannel: channelFromResources(
          packageJson.build.extraResources,
          "updates/channel.json"
        ),
        clientServices: packageJson.build.extraMetadata.clientServices
      }),
    /正式服务器目录通道尚未配置/
  );
});

test("the local Docker package has distinct names and active trusted channels", () => {
  assert.match(localReleaseConfig.portable.artifactName, /ZhenXing-AI-Local-/);
  assert.match(localReleaseConfig.nsis.artifactName, /ZhenXing-AI-Local-/);
  assert.deepEqual(
    localReleaseConfig.extraMetadata.clientServices,
    localClientServices
  );
  for (const destination of [
    "catalog/channel.json",
    "updates/channel.json",
    "local-release-trust.json"
  ]) {
    const resource = localReleaseConfig.extraResources.find(
      (entry) => entry.to === destination
    );
    assert.ok(resource, `missing ${destination}`);
    assert.match(
      path.normalize(resource.from),
      /deployment[\\/]local[\\/]runtime[\\/]current[\\/]client-config/
    );
  }
  const result = assertReleasePackageReady({
    variant: "local",
    catalogChannel: localChannel("catalog"),
    updateChannel: localChannel("update"),
    clientServices: localClientServices
  });
  assert.equal(result.variant, "local");
});

test("v2 packaging requires its own signed active catalog release", async (t) => {
  const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-v2-package-"));
  t.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const trustedKeys = [{
    keyId: "v2-package-test",
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64")
  }];
  const store = createReleaseStore({
    rootDirectory,
    signingKeyProvider: async () => ({ keyId: "v2-package-test", privateKey })
  });
  const base = {
    variant: "local",
    catalogChannel: v2Channel(trustedKeys),
    updateChannel: localChannel("update"),
    clientServices: localClientServices,
    catalogReleaseStoreDirectory: rootDirectory
  };

  assert.throws(() => assertReleasePackageReady(base), /v2.*active/i);
  await store.saveDraft({ catalog: catalogFixture(), expectedRevision: 0 });
  await store.publish({ channel: "v2", expectedDraftRevision: 1, expectedActiveCatalogVersion: 0 });
  assert.doesNotThrow(() => assertReleasePackageReady(base));
  const state = JSON.parse(fs.readFileSync(path.join(rootDirectory, "state.json"), "utf8"));
  fs.writeFileSync(
    path.join(rootDirectory, "releases", state.channels.v2.history[0].fileName),
    "{}\n"
  );
  assert.throws(() => assertReleasePackageReady(base), /v2.*unreadable/i);
});

test("production packaging remains closed while client services are empty", () => {
  assert.throws(
    () =>
      assertReleasePackageReady({
        variant: "production",
        catalogChannel: productionChannel("catalog"),
        updateChannel: productionChannel("update"),
        clientServices: packageJson.build.extraMetadata.clientServices
      }),
    /正式客户端身份与社区服务尚未配置/
  );
});

test("production packaging rejects loopback identity and community services", () => {
  assert.throws(
    () =>
      assertReleasePackageReady({
        variant: "production",
        catalogChannel: productionChannel("catalog"),
        updateChannel: productionChannel("update"),
        clientServices: {
          schemaVersion: 1,
          identityOrigin: "https://localhost:4180",
          communityOrigin: "https://localhost:8088"
        }
      }),
    /正式客户端身份与社区服务尚未配置/
  );
});
