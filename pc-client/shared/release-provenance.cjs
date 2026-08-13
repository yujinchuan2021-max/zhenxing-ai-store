"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RELEASE_VERSION = /^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const REVISION = /^[0-9a-f]{40}$/;

function exactKeys(value, fields) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((key) => fields.includes(key))
  );
}

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

function normalizeReleaseSource(value, version) {
  if (
    !RELEASE_VERSION.test(version || "") ||
    !exactKeys(value, ["revision", "dirty", "versionTag"]) ||
    typeof value.revision !== "string" ||
    !REVISION.test(value.revision) ||
    typeof value.dirty !== "boolean" ||
    (value.versionTag !== null && value.versionTag !== `v${version}`)
  ) {
    throw new Error("发布源码来源无效");
  }
  return {
    revision: value.revision,
    dirty: value.dirty,
    versionTag: value.versionTag
  };
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`无法读取发布源码状态：${String(result.stderr || "").trim()}`);
  }
  return String(result.stdout || "").trim();
}

function inspectGitReleaseSource({
  root,
  version,
  requireClean = false,
  requireVersionTag = false
}) {
  if (!path.isAbsolute(root) || !RELEASE_VERSION.test(version || "")) {
    throw new Error("发布源码检查参数无效");
  }
  const revision = runGit(root, ["rev-parse", "HEAD"]).toLowerCase();
  const dirty = Boolean(
    runGit(root, ["status", "--porcelain=v1", "--untracked-files=all", "--", "."])
  );
  const matchingTag = runGit(root, [
    "tag",
    "--points-at",
    "HEAD",
    "--list",
    `v${version}`
  ])
    .split(/\r?\n/)
    .find((entry) => entry === `v${version}`) || null;
  if (requireClean && dirty) {
    throw new Error("正式发布要求源码工作区无未提交改动");
  }
  if (requireVersionTag && matchingTag !== `v${version}`) {
    throw new Error(`正式发布源码必须绑定标签 v${version}`);
  }
  return normalizeReleaseSource(
    { revision, dirty, versionTag: matchingTag },
    version
  );
}

function artifactBuildMetadataPath(artifactPath) {
  const name = path.basename(artifactPath);
  const match = /^(ZhenXing-AI-(?:Local-)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)-Windows-x64-(?:Setup|Portable)\.exe(?:\.blockmap)?$/i.exec(
    name
  );
  if (!match) throw new Error("无法从制品名称确定构建来源文件");
  return path.join(path.dirname(artifactPath), `${match[1]}-BUILD.json`);
}

function createArtifactBuildMetadata({
  version,
  source,
  artifactPaths,
  builtAt = new Date().toISOString()
}) {
  if (
    !RELEASE_VERSION.test(version || "") ||
    !Array.isArray(artifactPaths) ||
    artifactPaths.length < 1 ||
    artifactPaths.length > 8 ||
    Number.isNaN(Date.parse(builtAt)) ||
    new Date(builtAt).toISOString() !== builtAt
  ) {
    throw new Error("构建来源清单参数无效");
  }
  const normalizedSource = normalizeReleaseSource(source, version);
  const artifacts = artifactPaths
    .map((artifactPath) => {
      if (!path.isAbsolute(artifactPath) || !fs.statSync(artifactPath).isFile()) {
        throw new Error("构建来源清单只能记录绝对文件路径");
      }
      return {
        name: path.basename(artifactPath),
        sha256: sha256File(artifactPath),
        fileSize: fs.statSync(artifactPath).size
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(artifacts.map((entry) => entry.name.toLowerCase())).size !== artifacts.length) {
    throw new Error("构建来源清单存在重复文件");
  }
  return {
    schemaVersion: 1,
    version,
    builtAt,
    source: normalizedSource,
    artifacts
  };
}

function validateArtifactBuildMetadata(value) {
  if (
    !exactKeys(value, ["schemaVersion", "version", "builtAt", "source", "artifacts"]) ||
    value.schemaVersion !== 1 ||
    !RELEASE_VERSION.test(value.version || "") ||
    typeof value.builtAt !== "string" ||
    Number.isNaN(Date.parse(value.builtAt)) ||
    new Date(value.builtAt).toISOString() !== value.builtAt ||
    !Array.isArray(value.artifacts) ||
    value.artifacts.length < 1 ||
    value.artifacts.length > 8
  ) {
    throw new Error("构建来源清单无效");
  }
  const source = normalizeReleaseSource(value.source, value.version);
  const artifacts = value.artifacts.map((entry) => {
    if (
      !exactKeys(entry, ["name", "sha256", "fileSize"]) ||
      typeof entry.name !== "string" ||
      !entry.name ||
      /[\\/]/.test(entry.name) ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 || "") ||
      !Number.isSafeInteger(entry.fileSize) ||
      entry.fileSize < 1
    ) {
      throw new Error("构建来源清单文件项无效");
    }
    return { ...entry };
  });
  if (new Set(artifacts.map((entry) => entry.name.toLowerCase())).size !== artifacts.length) {
    throw new Error("构建来源清单存在重复文件");
  }
  return {
    schemaVersion: 1,
    version: value.version,
    builtAt: value.builtAt,
    source,
    artifacts
  };
}

function verifyArtifactBuildMetadata({ metadata, artifactPath, version }) {
  if (!path.isAbsolute(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    throw new Error("待发布安装包不存在");
  }
  const normalized = validateArtifactBuildMetadata(metadata);
  if (normalized.version !== version) {
    throw new Error("构建来源清单版本与发布版本不一致");
  }
  const name = path.basename(artifactPath);
  const artifact = normalized.artifacts.find((entry) => entry.name === name);
  if (
    !artifact ||
    artifact.fileSize !== fs.statSync(artifactPath).size ||
    artifact.sha256 !== sha256File(artifactPath)
  ) {
    throw new Error("安装包与构建来源清单不一致");
  }
  return normalized;
}

function readArtifactBuildMetadata({ artifactPath, version }) {
  const metadataPath = artifactBuildMetadataPath(artifactPath);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`安装包缺少构建来源清单：${path.basename(metadataPath)}`);
  }
  return verifyArtifactBuildMetadata({
    metadata: JSON.parse(fs.readFileSync(metadataPath, "utf8")),
    artifactPath,
    version
  });
}

module.exports = {
  artifactBuildMetadataPath,
  createArtifactBuildMetadata,
  inspectGitReleaseSource,
  normalizeReleaseSource,
  readArtifactBuildMetadata,
  sha256File,
  validateArtifactBuildMetadata,
  verifyArtifactBuildMetadata
};
