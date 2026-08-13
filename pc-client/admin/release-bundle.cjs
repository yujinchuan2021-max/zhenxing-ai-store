"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  validateCatalogReleasePayload
} = require("../shared/catalog-release.cjs");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  validateUpdatePayload
} = require("../shared/update-release.cjs");
const {
  verifyArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");
const {
  publicKeyRecord
} = require("./signing-key.cjs");
const {
  isLoopbackHostname
} = require("../shared/client-services.cjs");
const {
  assertCatalogSigningKeyAllowed
} = require("../shared/catalog-key-retirement.cjs");

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function normalizeBaseUrl(value, allowLocalhost) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("发布地址无效");
  }
  const loopback = isLoopbackHostname(parsed.hostname);
  const localHttp =
    allowLocalhost && loopback && parsed.protocol === "http:";
  if (
    (!allowLocalhost && loopback) ||
    (!localHttp && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("生产发布地址必须使用非回环 HTTPS");
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/`;
  return parsed;
}

function atomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  replaceAtomically(temporary, filePath);
}

function copyAtomic(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporary = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.copyFileSync(sourcePath, temporary, fs.constants.COPYFILE_EXCL);
  replaceAtomically(temporary, targetPath);
}

function replaceAtomically(temporaryPath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.renameSync(temporaryPath, targetPath);
    return;
  }
  const backup = `${targetPath}.${process.pid}.${crypto.randomUUID()}.bak`;
  fs.renameSync(targetPath, backup);
  try {
    fs.renameSync(temporaryPath, targetPath);
    fs.unlinkSync(backup);
  } catch (error) {
    if (!fs.existsSync(targetPath) && fs.existsSync(backup)) {
      fs.renameSync(backup, targetPath);
    }
    throw error;
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function releaseChannel({ kind, releaseUrl, origin, key }) {
  return {
    schemaVersion: 2,
    kind,
    releaseUrl,
    allowedReleaseOrigins: [origin],
    trustedKeys: [key]
  };
}

function prepareReleaseBundle({
  outputDirectory,
  baseUrl,
  catalogEnvelope,
  installerPath,
  version,
  buildProvenance,
  attestedArtifactPaths = [installerPath],
  signingKeys,
  publishedAt = new Date().toISOString(),
  notes = [],
  rollout = { percentage: 100, salt: "local-release-2026" },
  allowLocalhost = false,
  allowLocalDevelopmentKeys = false
}) {
  assertCatalogSigningKeyAllowed(signingKeys?.catalog?.keyId, "package");
  if (!path.isAbsolute(outputDirectory) || !path.isAbsolute(installerPath)) {
    throw new Error("发布输出目录和安装包路径必须是绝对路径");
  }
  if (!fs.statSync(installerPath).isFile()) {
    throw new Error("更新安装包不存在");
  }
  if (
    !signingKeys ||
    ![
      "environment",
      ...(allowLocalDevelopmentKeys ? ["local-development"] : [])
    ].includes(signingKeys.catalog?.source) ||
    ![
      "environment",
      ...(allowLocalDevelopmentKeys ? ["local-development"] : [])
    ].includes(signingKeys.update?.source)
  ) {
    throw new Error("发布包只能使用两把独立、环境注入的签名私钥");
  }

  const root = normalizeBaseUrl(baseUrl, allowLocalhost);
  const catalogKey = publicKeyRecord(signingKeys.catalog.privateKey, "catalog");
  const updateKey = publicKeyRecord(signingKeys.update.privateKey, "update");
  if (catalogKey.publicKey === updateKey.publicKey) {
    throw new Error("目录发布和更新发布必须使用不同的签名私钥");
  }

  validateCatalogReleasePayload(catalogEnvelope.payload);
  const catalogPayload = catalogEnvelope.payload;
  const signedCatalog = createSignedEnvelope({
    kind: "catalog",
    keyId: catalogKey.keyId,
    payload: catalogPayload,
    privateKey: signingKeys.catalog.privateKey
  });

  const artifactName = path.basename(installerPath);
  const artifactMatch = /^ZhenXing-AI-(?:Local-)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)-Windows-x64-Setup\.exe$/i.exec(
    artifactName
  );
  if (!artifactMatch) {
    throw new Error("更新安装包文件名不符合枕星 AI Windows x64 规则");
  }
  if (artifactMatch[1] !== version) {
    throw new Error("更新安装包文件名版本与发布版本不一致");
  }
  if (
    !Array.isArray(attestedArtifactPaths) ||
    attestedArtifactPaths.length < 1 ||
    attestedArtifactPaths.length > 8 ||
    attestedArtifactPaths.some((entry) => !path.isAbsolute(entry)) ||
    !attestedArtifactPaths.some(
      (entry) => path.resolve(entry) === path.resolve(installerPath)
    ) ||
    new Set(attestedArtifactPaths.map((entry) => path.resolve(entry).toLowerCase()))
      .size !== attestedArtifactPaths.length
  ) {
    throw new Error("构建来源签名制品列表无效");
  }
  const verifiedBuild = verifyArtifactBuildMetadata({
    metadata: buildProvenance,
    artifactPath: installerPath,
    version
  });
  const attestedArtifacts = attestedArtifactPaths
    .map((artifactPath) => {
      verifyArtifactBuildMetadata({
        metadata: buildProvenance,
        artifactPath,
        version
      });
      return {
        name: path.basename(artifactPath),
        sha256: sha256File(artifactPath),
        fileSize: fs.statSync(artifactPath).size
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const artifactUrl = new URL(`artifacts/${artifactName}`, root).href;
  const updatePayload = validateUpdatePayload(
    {
      version,
      publishedAt,
      downloadUrl: artifactUrl,
      sha256: sha256File(installerPath),
      fileSize: fs.statSync(installerPath).size,
      platform: "win32",
      arch: "x64",
      channel: "stable",
      notes,
      rollout
    },
    [root.origin],
    { allowLocalhost }
  );
  const signedUpdate = createSignedEnvelope({
    kind: "update",
    keyId: updateKey.keyId,
    payload: updatePayload,
    privateKey: signingKeys.update.privateKey
  });
  const buildPayload = {
    schemaVersion: 2,
    version,
    builtAt: verifiedBuild.builtAt,
    source: verifiedBuild.source,
    artifacts: attestedArtifacts
  };
  const signedBuild = createSignedEnvelope({
    kind: "build-provenance",
    keyId: updateKey.keyId,
    payload: buildPayload,
    privateKey: signingKeys.update.privateKey
  });

  const catalogUrl = new URL("catalog-release.json", root).href;
  const updateUrl = new URL("update-release.json", root).href;
  const buildUrl = new URL("build-provenance.json", root).href;
  const publicDirectory = path.join(outputDirectory, "public");
  copyAtomic(installerPath, path.join(publicDirectory, "artifacts", artifactName));
  const catalogPath = path.join(publicDirectory, "catalog-release.json");
  const updatePath = path.join(publicDirectory, "update-release.json");
  const buildPath = path.join(publicDirectory, "build-provenance.json");
  const artifactPath = path.join(publicDirectory, "artifacts", artifactName);
  atomicJson(catalogPath, signedCatalog);
  atomicJson(updatePath, signedUpdate);
  atomicJson(buildPath, signedBuild);
  atomicJson(path.join(publicDirectory, "release-manifest.json"), {
    schemaVersion: 2,
    generatedAt: publishedAt,
    baseUrl: root.href,
    build: {
      url: buildUrl,
      builtAt: verifiedBuild.builtAt,
      source: verifiedBuild.source
    },
    signingKeys: {
      catalog: catalogKey,
      update: updateKey
    },
    catalog: {
      url: catalogUrl,
      releaseId: catalogPayload.releaseId,
      catalogVersion: catalogPayload.catalogVersion
    },
    update: {
      url: updateUrl,
      version,
      artifactUrl,
      sha256: updatePayload.sha256,
      fileSize: updatePayload.fileSize
    },
    files: [
      {
        path: "catalog-release.json",
        sha256: sha256File(catalogPath),
        fileSize: fs.statSync(catalogPath).size
      },
      {
        path: "update-release.json",
        sha256: sha256File(updatePath),
        fileSize: fs.statSync(updatePath).size
      },
      {
        path: "build-provenance.json",
        sha256: sha256File(buildPath),
        fileSize: fs.statSync(buildPath).size
      },
      {
        path: `artifacts/${artifactName}`,
        sha256: sha256File(artifactPath),
        fileSize: fs.statSync(artifactPath).size
      }
    ]
  });
  atomicJson(
    path.join(outputDirectory, "client-config", "catalog", "channel.json"),
    releaseChannel({
      kind: "catalog",
      releaseUrl: catalogUrl,
      origin: root.origin,
      key: catalogKey
    })
  );
  atomicJson(
    path.join(outputDirectory, "client-config", "updates", "channel.json"),
    releaseChannel({
      kind: "update",
      releaseUrl: updateUrl,
      origin: root.origin,
      key: updateKey
    })
  );

  return {
    outputDirectory,
    publicDirectory,
    signingKeys: {
      catalog: catalogKey,
      update: updateKey
    },
    catalogUrl,
    updateUrl,
    buildUrl,
    source: verifiedBuild.source,
    update: updatePayload
  };
}

module.exports = {
  prepareReleaseBundle,
  sha256File
};
