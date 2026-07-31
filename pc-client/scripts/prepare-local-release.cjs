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
const {
  discardActivatedLocalReleaseBackupBestEffort
} = require("../shared/local-release-retention.cjs");
const {
  readArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

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
      "release-local-server-client",
      `AI-Hub-Local-${packageVersion}-Windows-x64-Setup.exe`
    )
);
const releaseVersion = process.env.AIHUB_RELEASE_VERSION || packageVersion;
if (releaseVersion !== packageVersion) {
  throw new Error("本地发布版本必须与 package.json 完全一致");
}
const buildProvenance = readArtifactBuildMetadata({
  artifactPath: installerPath,
  version: releaseVersion
});
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
  version: releaseVersion,
  buildProvenance,
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
    "修复产品卡重新下载被失败任务拦截的问题；点击后会真正创建新的下载或断点续传尝试",
    "客户端更新下载统一隐藏 Electron 底层错误，只返回稳定错误码和简短提示",
    "修复客户端误装离线包后退回内置 8 厂商的问题；本地 Docker 版使用独立包名并强制校验发布通道",
    "客户端目录只接受后台签名版本或最后一次已验证缓存，不再用内置小目录伪装正常状态",
    "收录 49 个厂商和 148 个产品，补充 Kimi、OpenClaw、Antigravity、QClaw 与 Qoder 产品线",
    "产品详情新增 Skill 与 MCP 子目录，后台支持完整增删改查、排序和启停",
    "新增 CLI 官方安装入口模块，未经本地审核的 CLI 不执行后台下发命令",
    "新增 Codex ChatGPT Apps Skill 一键安装、状态检测和精准卸载",
    "修复社区渲染进程未挂载时出现灰屏，并自动恢复到原帖子",
    "社区讨论页增加全部讨论侧边提示",
    "修复本机头像上传成功后无法显示的问题",
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
  stagedBundleDirectory: stagingDirectory,
  allowLegacyV1Migration: true
});
const backupCleanup = deployment.backupName
  ? discardActivatedLocalReleaseBackupBestEffort({
      runtimeDirectory,
      backupName: deployment.backupName
    })
  : { discarded: false, cleanupPending: false, errorCode: null };

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      publicDirectory: path.join(deployment.current, "public"),
      discardedBackupName: backupCleanup.discarded
        ? deployment.backupName
        : null,
      backupCleanupPending: backupCleanup.cleanupPending,
      backupCleanupErrorCode: backupCleanup.errorCode,
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
    },
    null,
    2
  )}\n`
);
