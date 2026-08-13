"use strict";

const path = require("node:path");
const packageJson = require("./package.json");

const root = __dirname;
const catalogChannel = process.env.AIHUB_CATALOG_CHANNEL || "v1";
if (!["v1", "v2"].includes(catalogChannel)) {
  throw new Error("AIHUB_CATALOG_CHANNEL must be v1 or v2");
}
const catalogChannelSource =
  catalogChannel === "v2"
    ? path.join(root, "catalog", "channel.local-v2.json")
    : path.join(
        root,
        "deployment",
        "local",
        "runtime",
        "current",
        "client-config",
        "catalog",
        "channel.json"
      );

module.exports = {
  ...packageJson.build,
  extraMetadata: {
    ...packageJson.build.extraMetadata,
    version:
      process.env.AIHUB_LOCAL_RELEASE_BASE_VERSION || packageJson.version,
    localReleaseAcceptance: true,
    clientServices: {
      schemaVersion: 1,
      identityOrigin: "http://127.0.0.1:4180",
      communityOrigin: "http://127.0.0.1:8088"
    }
  },
  directories: {
    ...packageJson.build.directories,
    output: "release-local-server-client"
  },
  portable: {
    ...packageJson.build.portable,
    artifactName: "ZhenXing-AI-Local-${version}-Windows-${arch}-Portable.${ext}"
  },
  nsis: {
    ...packageJson.build.nsis,
    artifactName: "ZhenXing-AI-Local-${version}-Windows-${arch}-Setup.${ext}"
  },
  extraResources: [
    {
      from: path.join(root, "extension-resources"),
      to: "extensions"
    },
    {
      from: catalogChannelSource,
      to: "catalog/channel.json"
    },
    {
      from: path.join(
        root,
        "deployment",
        "local",
        "runtime",
        "current",
        "client-config",
        "updates",
        "channel.json"
      ),
      to: "updates/channel.json"
    },
    {
      from: path.join(
        root,
        "deployment",
        "local",
        "runtime",
        "current",
        "client-config",
        "local-release-trust.json"
      ),
      to: "local-release-trust.json"
    }
  ]
};
