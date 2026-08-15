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
  inspectGitReleaseSource,
  readArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

const root = path.resolve(__dirname, "..");
const baseUrl = String(process.env.AIHUB_RELEASE_BASE_URL || "").trim();
const version = String(process.env.AIHUB_RELEASE_VERSION || "").trim();
const installerInput = String(process.env.AIHUB_RELEASE_INSTALLER || "").trim();
if (!baseUrl || !version || !installerInput) {
  throw new Error(
    "生产发布需要 AIHUB_RELEASE_BASE_URL、AIHUB_RELEASE_VERSION 和 AIHUB_RELEASE_INSTALLER"
  );
}
const installerPath = path.resolve(installerInput);
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
).version;
if (version !== packageVersion) {
  throw new Error("生产发布版本必须与 package.json 完全一致");
}
const buildProvenance = readArtifactBuildMetadata({ installerPath, version });
const attestedArtifactPaths = buildProvenance.artifacts.map((artifact) =>
  path.join(path.dirname(installerPath), artifact.name)
);
if (buildProvenance.source.dirty) {
  throw new Error("生产发布拒绝使用包含未提交源码的安装包");
}
if (buildProvenance.source.versionTag !== `v${version}`) {
  throw new Error(`生产发布安装包必须来自标签 v${version}`);
}
const currentSource = inspectGitReleaseSource({
  root,
  version,
  requireClean: true,
  requireVersionTag: true
});
if (currentSource.revision !== buildProvenance.source.revision) {
  throw new Error("生产发布安装包与当前源码提交不一致");
}
const state = JSON.parse(
  fs.readFileSync(
    path.join(root, "admin", "published", "catalog-store", "state.json"),
    "utf8"
  )
);
const metadata = state.history.find(
  (entry) => entry.releaseId === state.activeReleaseId
);
if (!metadata) throw new Error("后台没有活动目录版本");
const catalogKeyMetadata = state.trustedKeys.find((entry) => entry.keyId === metadata.keyId);
if (!catalogKeyMetadata) throw new Error("后台活动目录签名公钥不存在");
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

const result = prepareReleaseBundle({
  outputDirectory: path.join(root, "deployment", "production"),
  baseUrl,
  catalogEnvelope,
  installerPath,
  version,
  buildProvenance,
  attestedArtifactPaths,
  signingKeys: {
    catalog: loadSigningKey({
      dataDirectory: path.join(root, "admin", "data"),
      env: process.env,
      requireEnvironment: true,
      environmentVariable: "AIHUB_CATALOG_SIGNING_PRIVATE_KEY",
      keyMetadata: catalogKeyMetadata
    }),
    update: loadSigningKey({
      dataDirectory: path.join(root, "admin", "data"),
      env: process.env,
      requireEnvironment: true,
      environmentVariable: "AIHUB_UPDATE_SIGNING_PRIVATE_KEY"
    })
  },
  notes: String(process.env.AIHUB_RELEASE_NOTES || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean),
  rollout: {
    percentage: Number(process.env.AIHUB_RELEASE_ROLLOUT || "0"),
    salt: String(
      process.env.AIHUB_RELEASE_ROLLOUT_SALT || `stable-${version}`
    )
  }
});

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      outputDirectory: result.outputDirectory,
      catalogUrl: result.catalogUrl,
      updateUrl: result.updateUrl,
      buildUrl: result.buildUrl,
      source: result.source,
      catalogKeyId: result.signingKeys.catalog.keyId,
      updateKeyId: result.signingKeys.update.keyId,
      artifact: {
        url: result.update.downloadUrl,
        fileSize: result.update.fileSize,
        sha256: result.update.sha256
      }
    },
    null,
    2
  )}\n`
);
