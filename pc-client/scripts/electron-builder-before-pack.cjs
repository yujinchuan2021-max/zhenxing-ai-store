"use strict";

const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");
const {
  assertReleasePackageReady
} = require("../shared/release-package-policy.cjs");

function channelFromResources(config, appDir, destination) {
  const resource = (config.extraResources || []).find(
    (entry) => entry?.to === destination
  );
  if (!resource || typeof resource.from !== "string") {
    throw new Error(`Missing ${destination} package resource`);
  }
  const source = path.isAbsolute(resource.from)
    ? resource.from
    : path.resolve(appDir, resource.from);
  return JSON.parse(fs.readFileSync(source, "utf8"));
}

async function assertElectronBuilderPackageChannels(context) {
  const config = context?.packager?.config;
  const appDir = context?.packager?.projectDir;
  if (!config || !path.isAbsolute(appDir || "")) {
    throw new Error("Electron Builder package context is invalid");
  }
  if (
    config.extraMetadata?.upgradeFixture === true &&
    config.extraMetadata.version !== packageJson.version
  ) {
    return;
  }
  const variant =
    config.extraMetadata?.localReleaseAcceptance === true
      ? "local"
      : "production";
  assertReleasePackageReady({
    variant,
    catalogChannel: channelFromResources(
      config,
      appDir,
      "catalog/channel.json"
    ),
    updateChannel: channelFromResources(
      config,
      appDir,
      "updates/channel.json"
    )
  });
}

module.exports = assertElectronBuilderPackageChannels;
