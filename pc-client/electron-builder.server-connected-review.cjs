"use strict";

const path = require("node:path");
const packageJson = require("./package.json");

const root = __dirname;

module.exports = {
  ...packageJson.build,
  extraMetadata: {
    ...packageJson.build.extraMetadata,
    serverConnectedReview: true,
    clientServices: {
      schemaVersion: 1,
      identityOrigin: "https://zhenxingai.com",
      communityOrigin: "https://community.zhenxingai.com"
    }
  },
  directories: {
    ...packageJson.build.directories,
    output: "release-server-connected-review"
  },
  portable: {
    ...packageJson.build.portable,
    unpackDirName: true,
    artifactName: "ZhenXing-AI-Server-Connected-Review-${version}-Windows-${arch}-Portable.${ext}"
  },
  nsis: {
    ...packageJson.build.nsis,
    artifactName: "ZhenXing-AI-Server-Connected-Review-${version}-Windows-${arch}-Setup.${ext}"
  },
  extraResources: [
    ...packageJson.build.extraResources.filter(({ to }) => ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"].includes(to)),
    {
      from: path.join(root, "extension-resources"),
      to: "extensions"
    },
    {
      from: path.join(root, "catalog", "channel.server-connected-review.json"),
      to: "catalog/channel.json"
    },
    {
      from: path.join(root, "updates", "channel.server-connected-review.json"),
      to: "updates/channel.json"
    }
  ]
};
