"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  verifyCatalogRelease,
  verifyCatalogReleaseIntegrity
} = require("../shared/catalog-release.cjs");
const {
  readReleaseChannel
} = require("../shared/release-channel.cjs");
const {
  validateSignedUpdateRelease
} = require("../shared/update-release.cjs");
const {
  sha256File
} = require("./release-bundle.cjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePublicFile(publicDirectory, relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.startsWith("../")
  ) {
    throw new Error("发布包文件路径无效");
  }
  const target = path.resolve(publicDirectory, ...relativePath.split("/"));
  if (!target.startsWith(`${path.resolve(publicDirectory)}${path.sep}`)) {
    throw new Error("发布包文件越过公开目录");
  }
  return target;
}

function verifyReleaseBundle({
  bundleDirectory,
  allowLocalhost = false,
  allowCatalogPolicyDrift = false
}) {
  if (!path.isAbsolute(bundleDirectory)) {
    throw new Error("发布包目录必须是绝对路径");
  }
  const publicDirectory = path.join(bundleDirectory, "public");
  const manifest = readJson(
    path.join(publicDirectory, "release-manifest.json")
  );
  if (
    manifest?.schemaVersion !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 3
  ) {
    throw new Error("发布包清单结构无效");
  }
  for (const entry of manifest.files) {
    const target = resolvePublicFile(publicDirectory, entry.path);
    const stat = fs.statSync(target);
    if (
      !stat.isFile() ||
      stat.size !== entry.fileSize ||
      sha256File(target) !== entry.sha256
    ) {
      throw new Error(`发布包文件完整性校验失败：${entry.path}`);
    }
  }

  const catalogChannel = readReleaseChannel(
    readJson(
      path.join(
        bundleDirectory,
        "client-config",
        "catalog",
        "channel.json"
      )
    ),
    { kind: "catalog", allowLocalhost }
  );
  const updateChannel = readReleaseChannel(
    readJson(
      path.join(
        bundleDirectory,
        "client-config",
        "updates",
        "channel.json"
      )
    ),
    { kind: "update", allowLocalhost }
  );
  if (
    catalogChannel.releaseUrl !== manifest.catalog.url ||
    updateChannel.releaseUrl !== manifest.update.url
  ) {
    throw new Error("发布包通道与清单地址不一致");
  }
  const catalogEnvelope = readJson(
    path.join(publicDirectory, "catalog-release.json")
  );
  let catalog;
  let catalogPolicyCompatible = true;
  if (allowCatalogPolicyDrift) {
    catalog = verifyCatalogReleaseIntegrity(catalogEnvelope, {
      trustedKeys: catalogChannel.trustedKeys
    });
    try {
      verifyCatalogRelease(catalogEnvelope, {
        trustedKeys: catalogChannel.trustedKeys,
        clientId: "bundle-verifier-2026"
      });
    } catch {
      catalogPolicyCompatible = false;
    }
  } else {
    catalog = verifyCatalogRelease(catalogEnvelope, {
      trustedKeys: catalogChannel.trustedKeys,
      clientId: "bundle-verifier-2026"
    });
  }
  const update = validateSignedUpdateRelease(
    readJson(path.join(publicDirectory, "update-release.json")),
    {
      trustedKeys: updateChannel.trustedKeys,
      allowedDownloadOrigins: updateChannel.allowedReleaseOrigins,
      allowLocalhost
    }
  );
  if (
    catalog.releaseId !== manifest.catalog.releaseId ||
    catalog.catalogVersion !== manifest.catalog.catalogVersion ||
    update.version !== manifest.update.version ||
    update.downloadUrl !== manifest.update.artifactUrl ||
    update.sha256 !== manifest.update.sha256 ||
    update.fileSize !== manifest.update.fileSize
  ) {
    throw new Error("发布包签名内容与总清单不一致");
  }

  return {
    catalogVersion: catalog.catalogVersion,
    updateVersion: update.version,
    artifactUrl: update.downloadUrl,
    catalogKeyId: catalogChannel.trustedKeys[0].keyId,
    updateKeyId: updateChannel.trustedKeys[0].keyId,
    catalogPolicyCompatible
  };
}

module.exports = {
  verifyReleaseBundle
};
