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
const {
  normalizeReleaseSource
} = require("../shared/release-provenance.cjs");
const {
  verifySignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    Object.keys(value).every((key) => expected.includes(key))
  );
}

function assertTrustedDirectory(directory, rootDirectory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("发布包包含不可信目录");
  }
  const realRoot = fs.realpathSync.native(rootDirectory);
  const realDirectory = fs.realpathSync.native(directory);
  const relative = path.relative(realRoot, realDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("发布包目录越过可信根目录");
  }
}

function assertTrustedReleaseBundleLayout(bundleDirectory) {
  if (!path.isAbsolute(bundleDirectory)) {
    throw new Error("发布包目录必须是绝对路径");
  }
  const root = path.resolve(bundleDirectory);
  assertTrustedDirectory(root, root);
  for (const relative of [
    "public",
    "public/artifacts",
    "client-config",
    "client-config/catalog",
    "client-config/updates"
  ]) {
    assertTrustedDirectory(path.join(root, ...relative.split("/")), root);
  }
  return root;
}

function assertTrustedFile(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("发布包包含不可信文件");
  }
  return stat;
}

function collectTrustedTree(rootDirectory, directory = rootDirectory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      throw new Error("发布包包含不可信链接");
    }
    const relative = path
      .relative(rootDirectory, target)
      .split(path.sep)
      .join("/");
    if (stat.isDirectory()) {
      result.push(`${relative}/`);
      collectTrustedTree(rootDirectory, target, result);
    } else if (stat.isFile()) {
      result.push(relative);
    } else {
      throw new Error("发布包包含不支持的文件类型");
    }
  }
  return result;
}

function assertExactTree(rootDirectory, expectedEntries, label) {
  const actual = collectTrustedTree(rootDirectory).sort();
  const expected = [...expectedEntries].sort();
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error(`${label}包含未声明文件或缺少必要文件`);
  }
}

function readJson(filePath) {
  assertTrustedFile(filePath);
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

function validIsoTimestamp(value) {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function sameSigningKey(left, right) {
  return (
    exactKeys(left, ["keyId", "publicKey"]) &&
    exactKeys(right, ["keyId", "publicKey"]) &&
    left.keyId === right.keyId &&
    left.publicKey === right.publicKey
  );
}

function validateManifestShape(manifest, schemaVersion) {
  const topLevelKeys = [
    "schemaVersion",
    "generatedAt",
    "baseUrl",
    ...(schemaVersion === 2 ? ["build"] : []),
    "signingKeys",
    "catalog",
    "update",
    "files"
  ];
  if (
    !exactKeys(manifest, topLevelKeys) ||
    manifest.schemaVersion !== schemaVersion ||
    !validIsoTimestamp(manifest.generatedAt) ||
    typeof manifest.baseUrl !== "string" ||
    !exactKeys(manifest.signingKeys, ["catalog", "update"]) ||
    !exactKeys(manifest.catalog, ["url", "releaseId", "catalogVersion"]) ||
    !exactKeys(manifest.update, [
      "url",
      "version",
      "artifactUrl",
      "sha256",
      "fileSize"
    ]) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== (schemaVersion === 2 ? 4 : 3) ||
    (schemaVersion === 2 &&
      (!exactKeys(manifest.build, ["url", "builtAt", "source"]) ||
        !validIsoTimestamp(manifest.build.builtAt)))
  ) {
    throw new Error(
      schemaVersion === 2
        ? "发布包清单结构无效"
        : "旧版发布包清单结构无效"
    );
  }
  for (const entry of manifest.files) {
    if (
      !exactKeys(entry, ["path", "sha256", "fileSize"]) ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.fileSize) ||
      entry.fileSize <= 0
    ) {
      throw new Error("发布包文件声明无效");
    }
  }
}

function verifyDeclaredFiles({
  manifest,
  publicDirectory,
  expectedPaths,
  legacy
}) {
  const declaredPaths = manifest.files.map((entry) => entry.path);
  if (
    new Set(declaredPaths).size !== declaredPaths.length ||
    declaredPaths.length !== expectedPaths.size ||
    declaredPaths.some((entry) => !expectedPaths.has(entry))
  ) {
    throw new Error(
      legacy
        ? "旧版发布包清单文件集合无效"
        : "发布包清单文件集合无效"
    );
  }
  assertExactTree(
    publicDirectory,
    new Set(["artifacts/", "release-manifest.json", ...expectedPaths]),
    legacy ? "旧版发布目录" : "发布目录"
  );
  for (const entry of manifest.files) {
    const target = resolvePublicFile(publicDirectory, entry.path);
    const stat = assertTrustedFile(target);
    if (
      stat.size !== entry.fileSize ||
      sha256File(target) !== entry.sha256
    ) {
      throw new Error(
        `${legacy ? "旧版" : ""}发布包文件完整性校验失败：${entry.path}`
      );
    }
  }
}

function verifyCommonReleaseBundle({
  bundleDirectory,
  schemaVersion,
  allowLocalhost,
  allowCatalogPolicyDrift,
  allowLocalRuntimeTrust
}) {
  const rootDirectory = assertTrustedReleaseBundleLayout(bundleDirectory);
  const publicDirectory = path.join(rootDirectory, "public");
  const manifest = readJson(
    path.join(publicDirectory, "release-manifest.json")
  );
  validateManifestShape(manifest, schemaVersion);

  let baseUrl;
  let artifactName;
  try {
    baseUrl = new URL(manifest.baseUrl);
    artifactName = path.basename(new URL(manifest.update.artifactUrl).pathname);
  } catch {
    throw new Error("发布包地址无效");
  }
  const artifactMatch = /^ZhenXing-AI-(?:Local-)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)-Windows-x64-Setup\.exe$/i.exec(
    artifactName
  );
  if (!artifactMatch || artifactMatch[1] !== manifest.update.version) {
    throw new Error("发布包安装包文件名与版本不一致");
  }
  const expectedPaths = new Set([
    "catalog-release.json",
    "update-release.json",
    ...(schemaVersion === 2 ? ["build-provenance.json"] : []),
    `artifacts/${artifactName}`
  ]);
  verifyDeclaredFiles({
    manifest,
    publicDirectory,
    expectedPaths,
    legacy: schemaVersion === 1
  });
  const clientConfigDirectory = path.join(rootDirectory, "client-config");
  const localTrustPath = path.join(
    clientConfigDirectory,
    "local-release-trust.json"
  );
  const hasLocalRuntimeTrust = fs.existsSync(localTrustPath);
  assertExactTree(
    clientConfigDirectory,
    new Set([
      "catalog/",
      "catalog/channel.json",
      "updates/",
      "updates/channel.json",
      ...(allowLocalRuntimeTrust && hasLocalRuntimeTrust
        ? ["local-release-trust.json"]
        : [])
    ]),
    "发布通道目录"
  );
  if (hasLocalRuntimeTrust) {
    if (!allowLocalRuntimeTrust) {
      throw new Error("发布包不得携带本地运行时证书覆盖层");
    }
    validateLocalReleaseTrust(readJson(localTrustPath));
  }

  const catalogChannel = readReleaseChannel(
    readJson(
      path.join(rootDirectory, "client-config", "catalog", "channel.json")
    ),
    { kind: "catalog", allowLocalhost }
  );
  const updateChannel = readReleaseChannel(
    readJson(
      path.join(rootDirectory, "client-config", "updates", "channel.json")
    ),
    { kind: "update", allowLocalhost }
  );
  if (
    catalogChannel.releaseUrl !== manifest.catalog.url ||
    updateChannel.releaseUrl !== manifest.update.url ||
    new URL("catalog-release.json", baseUrl).href !== manifest.catalog.url ||
    new URL("update-release.json", baseUrl).href !== manifest.update.url ||
    new URL(`artifacts/${artifactName}`, baseUrl).href !==
      manifest.update.artifactUrl ||
    !catalogChannel.trustedKeys.some((key) =>
      sameSigningKey(key, manifest.signingKeys.catalog)
    ) ||
    !updateChannel.trustedKeys.some((key) =>
      sameSigningKey(key, manifest.signingKeys.update)
    ) ||
    manifest.signingKeys.catalog.publicKey ===
      manifest.signingKeys.update.publicKey
  ) {
    throw new Error("发布包通道与清单不一致");
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
    rootDirectory,
    publicDirectory,
    manifest,
    artifactName,
    catalogChannel,
    updateChannel,
    catalog,
    update,
    catalogPolicyCompatible
  };
}

function publicVerificationResult(common) {
  return {
    catalogVersion: common.catalog.catalogVersion,
    updateVersion: common.update.version,
    artifactUrl: common.update.downloadUrl,
    catalogKeyId: common.catalogChannel.trustedKeys[0].keyId,
    updateKeyId: common.updateChannel.trustedKeys[0].keyId,
    catalogPolicyCompatible: common.catalogPolicyCompatible
  };
}

function verifyReleaseBundle({
  bundleDirectory,
  allowLocalhost = false,
  allowCatalogPolicyDrift = false,
  allowLocalRuntimeTrust = false
}) {
  const common = verifyCommonReleaseBundle({
    bundleDirectory,
    schemaVersion: 2,
    allowLocalhost,
    allowCatalogPolicyDrift,
    allowLocalRuntimeTrust
  });
  const build = verifySignedEnvelope(
    readJson(path.join(common.publicDirectory, "build-provenance.json")),
    {
      kind: "build-provenance",
      trustedKeys: common.updateChannel.trustedKeys
    }
  );
  const buildKeys =
    build.schemaVersion === 1
      ? ["schemaVersion", "version", "builtAt", "source", "artifact"]
      : ["schemaVersion", "version", "builtAt", "source", "artifacts"];
  if (
    ![1, 2].includes(build.schemaVersion) ||
    !exactKeys(build, buildKeys) ||
    build.version !== common.manifest.update.version ||
    build.builtAt !== common.manifest.build.builtAt
  ) {
    throw new Error("构建来源签名内容无效");
  }
  const buildArtifacts =
    build.schemaVersion === 1 ? [build.artifact] : build.artifacts;
  if (
    !Array.isArray(buildArtifacts) ||
    buildArtifacts.length < 1 ||
    buildArtifacts.length > 8 ||
    buildArtifacts.some(
      (entry) =>
        !exactKeys(entry, ["name", "sha256", "fileSize"]) ||
        typeof entry.name !== "string" ||
        !entry.name ||
        /[\\/]/.test(entry.name) ||
        !/^[0-9a-f]{64}$/.test(entry.sha256 || "") ||
        !Number.isSafeInteger(entry.fileSize) ||
        entry.fileSize < 1
    ) ||
    new Set(buildArtifacts.map((entry) => entry.name.toLowerCase())).size !==
      buildArtifacts.length
  ) {
    throw new Error("构建来源签名制品列表无效");
  }
  const signedInstaller = buildArtifacts.find(
    (entry) => entry.name === common.artifactName
  );
  if (
    !signedInstaller ||
    signedInstaller.sha256 !== common.manifest.update.sha256 ||
    signedInstaller.fileSize !== common.manifest.update.fileSize
  ) {
    throw new Error("构建来源签名安装包与更新清单不一致");
  }
  const source = normalizeReleaseSource(build.source, build.version);
  if (
    common.manifest.build.url !==
      new URL("build-provenance.json", common.manifest.baseUrl).href ||
    JSON.stringify(common.manifest.build.source) !== JSON.stringify(source)
  ) {
    throw new Error("构建来源签名内容与总清单不一致");
  }
  return {
    ...publicVerificationResult(common),
    source,
    builtAt: build.builtAt,
    buildArtifacts: buildArtifacts.map((entry) => ({ ...entry }))
  };
}

function verifyLegacyReleaseBundleV1({
  bundleDirectory,
  allowLocalhost = false,
  allowCatalogPolicyDrift = false,
  allowLocalRuntimeTrust = false
}) {
  const common = verifyCommonReleaseBundle({
    bundleDirectory,
    schemaVersion: 1,
    allowLocalhost,
    allowCatalogPolicyDrift,
    allowLocalRuntimeTrust
  });
  return {
    ...publicVerificationResult(common),
    legacySchemaVersion: 1
  };
}

module.exports = {
  verifyLegacyReleaseBundleV1,
  verifyReleaseBundle
};
