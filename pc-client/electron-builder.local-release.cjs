"use strict";

const path = require("node:path");
const packageJson = require("./package.json");

const root = __dirname;

module.exports = {
  ...packageJson.build,
  extraMetadata: {
    version: process.env.AIHUB_LOCAL_RELEASE_BASE_VERSION || "0.1.5",
    localReleaseAcceptance: true
  },
  directories: {
    ...packageJson.build.directories,
    output: "release-local-server-client"
  },
  extraResources: [
    {
      from: path.join(
        root,
        "deployment",
        "local",
        "runtime",
        "current",
        "client-config",
        "catalog",
        "channel.json"
      ),
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
