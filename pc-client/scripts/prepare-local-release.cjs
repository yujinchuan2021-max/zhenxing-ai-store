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
  activateStagedBundle,
  discardStagedBundleCandidateBestEffort,
  finalizeActivatedRelease,
  rollbackActivatedRelease
} = require("../admin/local-release-deployment.cjs");
const {
  readArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");
const {
  localReleaseCommandResult
} = require("../shared/local-release-command-result.cjs");

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
const catalogKeyMetadata = state.trustedKeys.find((entry) => entry.keyId === metadata.keyId);
if (!catalogKeyMetadata) throw new Error("活动目录签名公钥不存在");
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
      "release-local-server-client",
      `ZhenXing-AI-Local-${packageVersion}-Windows-x64-Setup.exe`
    )
);
const portablePath = path.join(
  path.dirname(installerPath),
  `ZhenXing-AI-Local-${packageVersion}-Windows-x64-Portable.exe`
);
const releaseVersion = process.env.AIHUB_RELEASE_VERSION || packageVersion;
if (releaseVersion !== packageVersion) {
  throw new Error("本地发布版本必须与 package.json 完全一致");
}
const buildProvenance = readArtifactBuildMetadata({
  artifactPath: installerPath,
  version: releaseVersion
});
function localSigningKey(environmentVariable, dataDirectory, keyMetadata = null) {
  return loadSigningKey({
    dataDirectory,
    env: process.env,
    environmentVariable,
    keyMetadata
  });
}

const runtimeDirectory = path.join(root, "deployment", "local", "runtime");
const stagingDirectory = path.join(
  runtimeDirectory,
  "staging",
  `prepare-${Date.now()}-${process.pid}`
);
const resultFileFlagIndex = process.argv.indexOf("--result-file");
const resultFile =
  resultFileFlagIndex >= 0
    ? path.resolve(String(process.argv[resultFileFlagIndex + 1] || ""))
    : null;
if (
  resultFileFlagIndex >= 0 &&
  (!process.argv[resultFileFlagIndex + 1] ||
    process.argv.length !== resultFileFlagIndex + 2)
) {
  throw new Error("--result-file 必须提供唯一的结果文件路径");
}

function writeResultFile(filePath, value) {
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error("发布事务结果文件必须是绝对路径");
  }
  const parent = path.dirname(filePath);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("发布事务结果目录不可信");
  }
  if (fs.existsSync(filePath)) {
    throw new Error("发布事务结果文件已经存在");
  }
  const temporary = path.join(
    parent,
    `.${path.basename(filePath)}.${process.pid}.tmp`
  );
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  try {
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

let deployment = null;
let expectedCurrent = null;
let completed = false;
let transactionFinalized = false;
try {
const result = prepareReleaseBundle({
  outputDirectory: stagingDirectory,
  baseUrl: process.env.AIHUB_RELEASE_BASE_URL || "https://localhost:4443/",
  catalogEnvelope,
  installerPath,
  version: releaseVersion,
  buildProvenance,
  attestedArtifactPaths: [installerPath, portablePath],
  signingKeys: {
    catalog: localSigningKey(
      "AIHUB_CATALOG_SIGNING_PRIVATE_KEY",
      path.join(root, "admin", "data"),
      catalogKeyMetadata
    ),
    update: localSigningKey(
      "AIHUB_UPDATE_SIGNING_PRIVATE_KEY",
      path.join(root, "deployment", "local", "private", "update")
    )
  },
  notes: [
    "完成 ChatGPT、Claude、Comfy Desktop 与 Ollama 的统一桌面生命周期模块",
    "新增重新安装与获取最新版入口，并在每次操作前重新检测产品和依赖环境",
    "首次安装才跟踪安装状态迁移；重装与更新不再用既有安装证据误报完成",
    "最新版下载按新任务代际接收状态，并在全局下载准入成功后才清理旧安装包",
    "下载完成和安装器启动前统一校验 Authenticode、PE 架构与产品身份",
    "安装状态以可信探针为准；可靠缺失会清除旧证据，未知结果不会误判未安装",
    "后台控制产品展示和启停，本地白名单继续独占下载、安装、打开与卸载权限",
    "记录 Microsoft Store 或厂商自身的更新所有权，不与产品自带更新器竞争",
    "Comfy 与 Ollama 卸载流程展示产品级数据保留规则并保持厂商交互选择",
    "身份与社区只读取后台活动目录，不再使用旧的静态八厂商目录文件",
    "更新 Claude 与 Comfy Desktop 官方消费者下载入口，并发布后台目录 v30",
    "修复开发预览新增 CommonJS 模块未预构建导致的白屏"
  ],
  rollout: { percentage: 100, salt: "local-release-2026" },
  allowLocalhost: true,
  allowLocalDevelopmentKeys: true
});
deployment = activateStagedBundle({
  runtimeDirectory,
  stagedBundleDirectory: stagingDirectory,
  allowLegacyV1Migration: true,
  retainPreviousRelease: true
});
expectedCurrent = {
  version: result.update.version,
  sha256: result.update.sha256,
  source: result.source
};
let receipt = localReleaseCommandResult({
      publicDirectory: path.join(deployment.current, "public"),
      backupName: deployment.backupName,
      retiredName: deployment.retiredName,
      expectedCurrent,
      migratedLegacyCurrent: deployment.migratedLegacyCurrent,
      discardedIncompatibleCurrent: deployment.discardedIncompatibleCurrent,
      retiredCleanupPending: deployment.retiredCleanupPending,
      stagingCleanupPending: deployment.stagingCleanupPending,
      staleLockCleanupPending: deployment.staleLockCleanupPending,
      activationLockCleanupPending:
        deployment.activationLockCleanupPending,
      activationLockCleanupErrorCode:
        deployment.activationLockCleanupErrorCode,
      catalogUrl: result.catalogUrl,
      updateUrl: result.updateUrl,
      buildUrl: result.buildUrl,
      version: result.update.version,
      source: result.source,
      sha256: result.update.sha256,
      fileSize: result.update.fileSize,
      catalogKeyId: result.signingKeys.catalog.keyId,
      updateKeyId: result.signingKeys.update.keyId
});
if (resultFile) {
  writeResultFile(resultFile, receipt);
} else {
  const finalization = finalizeActivatedRelease({
    runtimeDirectory,
    backupName: deployment.backupName,
    retiredName: deployment.retiredName,
    expectedCurrent
  });
  transactionFinalized = finalization.finalized === true;
  receipt = localReleaseCommandResult({
    ...receipt,
    ...finalization,
    retiredCleanupPending:
      receipt.retiredCleanupPending || finalization.cleanupPending,
    activationLockCleanupPending:
      receipt.activationLockCleanupPending ||
      finalization.activationLockCleanupPending,
    activationLockCleanupErrorCode:
      finalization.activationLockCleanupErrorCode ||
      receipt.activationLockCleanupErrorCode
  });
  if (!receipt.ok) {
    throw new Error(
      `本地发布旧版本清理待处理：${finalization.cleanupErrorCode}`
    );
  }
  receipt.transactionFinalized = true;
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
completed = true;
if (!receipt.ok) process.exitCode = 2;
} catch (error) {
  if (deployment && !transactionFinalized) {
    try {
      rollbackActivatedRelease({
        runtimeDirectory,
        backupName: deployment.backupName,
        retiredName: deployment.retiredName,
        expectedCurrent
      });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "本地发布准备失败且自动回滚失败"
      );
    }
  }
  throw error;
} finally {
  if (!completed && !deployment) {
    const cleanup = discardStagedBundleCandidateBestEffort(
      runtimeDirectory,
      stagingDirectory
    );
    if (cleanup.cleanupPending) {
      process.stderr.write(
        `本地发布 staging 清理待处理：${cleanup.errorCode}\n`
      );
    }
  }
}
