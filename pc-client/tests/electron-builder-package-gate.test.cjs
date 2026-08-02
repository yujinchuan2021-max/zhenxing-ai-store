"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const packageJson = require("../package.json");
const localReleaseConfig = require("../electron-builder.local-release.cjs");
const assertElectronBuilderPackageChannels = require(
  "../scripts/electron-builder-before-pack.cjs"
);

function context(config) {
  const appDir = require("node:path").resolve(__dirname, "..");
  return {
    packager: { config, projectDir: appDir }
  };
}

test("direct production electron-builder calls fail while channels are disabled", async () => {
  assert.equal(
    packageJson.build.beforePack,
    "scripts/electron-builder-before-pack.cjs"
  );
  await assert.rejects(
    assertElectronBuilderPackageChannels(context(packageJson.build)),
    /正式服务器目录通道尚未配置/
  );
});

test("direct local electron-builder calls accept the signed Docker channels", async () => {
  await assert.doesNotReject(
    assertElectronBuilderPackageChannels(context(localReleaseConfig))
  );
});
