"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
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
        )
      }),
    /正式服务器目录通道尚未配置/
  );
});

test("the local Docker package has distinct names and active trusted channels", () => {
  assert.match(localReleaseConfig.portable.artifactName, /ZhenXing-AI-Local-/);
  assert.match(localReleaseConfig.nsis.artifactName, /ZhenXing-AI-Local-/);
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
    updateChannel: localChannel("update")
  });
  assert.equal(result.variant, "local");
});
