"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  prepareReleaseBundle
} = require("../admin/release-bundle.cjs");
const {
  loadSigningKey
} = require("../admin/signing-key.cjs");
const {
  activateStagedBundle
} = require("../admin/local-release-deployment.cjs");

const root = path.resolve(__dirname, "..");
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
).version;
const state = JSON.parse(
  fs.readFileSync(
    path.join(root, "admin", "published", "catalog-store", "state.json"),
    "utf8"
  )
);
if (!state.activeReleaseId) {
  throw new Error("后台尚未发布可用于打包的目录版本");
}
const metadata = state.history.find(
  (entry) => entry.releaseId === state.activeReleaseId
);
if (!metadata) {
  throw new Error("活动目录发布记录不存在");
}
const catalogEnvelope = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "admin",
      "published",
      "catalog-store",
      "releases",
      metadata.fileName
    ),
    "utf8"
  )
);
const installerPath = path.resolve(
  process.env.AIHUB_RELEASE_INSTALLER ||
    path.join(
      root,
      "release",
      `AI-Hub-${packageVersion}-Windows-x64-Setup.exe`
    )
);
function localSigningKey(environmentVariable, dataDirectory) {
  return loadSigningKey({
    dataDirectory,
    env: process.env,
    environmentVariable
  });
}

const runtimeDirectory = path.join(root, "deployment", "local", "runtime");
const stagingDirectory = path.join(
  runtimeDirectory,
  "staging",
  `prepare-${Date.now()}-${process.pid}`
);
const result = prepareReleaseBundle({
  outputDirectory: stagingDirectory,
  baseUrl: process.env.AIHUB_RELEASE_BASE_URL || "https://localhost:4443/",
  catalogEnvelope,
  installerPath,
  version: process.env.AIHUB_RELEASE_VERSION || packageVersion,
  signingKeys: {
    catalog: localSigningKey(
      "AIHUB_CATALOG_SIGNING_PRIVATE_KEY",
      path.join(root, "admin", "data")
    ),
    update: localSigningKey(
      "AIHUB_UPDATE_SIGNING_PRIVATE_KEY",
      path.join(root, "deployment", "local", "private", "update")
    )
  },
  notes: [
    "优化个人中心联系方式修改与本地头像上传",
    "统一按钮按压反馈，并集中管理 PC 中英文文案",
    "PC 语言设置与内置 Flarum 社区同步"
  ],
  rollout: { percentage: 100, salt: "local-release-2026" },
  allowLocalhost: false,
  allowLocalDevelopmentKeys: true
});
const deployment = activateStagedBundle({
  runtimeDirectory,
  stagedBundleDirectory: stagingDirectory
});

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      publicDirectory: path.join(deployment.current, "public"),
      backupName: deployment.backupName,
      catalogUrl: result.catalogUrl,
      updateUrl: result.updateUrl,
      version: result.update.version,
      sha256: result.update.sha256,
      fileSize: result.update.fileSize,
      catalogKeyId: result.signingKeys.catalog.keyId,
      updateKeyId: result.signingKeys.update.keyId
    },
    null,
    2
  )}\n`
);
