"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  verifyLegacyReleaseBundleV1: verifyStrictLegacyReleaseBundleV1,
  verifyMigratableReleaseBundle: verifyStrictMigratableReleaseBundle,
  verifyReleaseBundle: verifyStrictReleaseBundle
} = require("./release-bundle-verifier.cjs");
const {
  compareVersions
} = require("../shared/update.cjs");
const {
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

const BACKUP_NAME = /^(?:auto|manual)-\d{8}T\d{6}Z-[a-z0-9][a-z0-9._-]{2,120}$/;
const AUTO_BACKUP_NAME = /^auto-\d{8}T\d{6}Z-[a-z0-9][a-z0-9._-]{2,120}$/;
const DISCARD_NAME = /^discard-\d{8}T\d{6}Z(?:-\d{1,3})?$/;
const ACTIVATION_LOCK_NAME = ".activation-lock";
const ACTIVATION_LOCK_OWNER = "owner.json";
const ACTIVATION_LOCK_INITIALIZATION_GRACE_MS = 30_000;
const ACTIVATION_LOCK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function verifyReleaseBundle(options) {
  return verifyStrictReleaseBundle({ ...options, allowLocalhost: true });
}

function verifyLegacyReleaseBundleV1(options) {
  return verifyStrictLegacyReleaseBundleV1({
    ...options,
    allowLocalhost: true
  });
}

function verifyMigratableReleaseBundle(options) {
  return verifyStrictMigratableReleaseBundle({
    ...options,
    allowLocalhost: true
  });
}

function compactTimestamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function assertDirectChild(parent, target) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep)
  ) {
    throw new Error("发布目录必须是运行目录的直接子目录");
  }
}

function readManifest(bundleDirectory) {
  const manifestPath = path.join(
    bundleDirectory,
    "public",
    "release-manifest.json"
  );
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function releaseLabel(bundleDirectory) {
  const manifest = readManifest(bundleDirectory);
  const raw = `${manifest.catalog.releaseId}-${manifest.update.version}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 120);
  if (!/^[a-z0-9][a-z0-9._-]{2,120}$/.test(raw)) {
    throw new Error("发布版本标识无效");
  }
  return raw;
}

function assertTrustedExistingDirectoryChain(directory) {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  let current = root;
  for (const segment of path.relative(root, resolved).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (!fs.existsSync(current)) {
      throw new Error("发布运行目录的可信父目录不存在");
    }
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("发布运行目录的父级包含不可信目录");
    }
  }
  return fs.realpathSync.native(resolved);
}

function ensureRuntime(runtimeDirectory) {
  const resolved = path.resolve(runtimeDirectory);
  const parent = path.dirname(resolved);
  const realParent = assertTrustedExistingDirectoryChain(parent);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved);
  }
  const rootStat = fs.lstatSync(resolved);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("发布运行目录不是可信目录");
  }
  const realRoot = fs.realpathSync.native(resolved);
  const relativeToParent = path.relative(realParent, realRoot);
  if (
    !relativeToParent ||
    relativeToParent.startsWith("..") ||
    path.isAbsolute(relativeToParent) ||
    relativeToParent.includes(path.sep)
  ) {
    throw new Error("发布运行目录越过可信父目录");
  }
  for (const name of ["backups", "staging"]) {
    const directory = path.join(resolved, name);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("发布运行目录包含不可信目录");
    }
    const relative = path.relative(
      realRoot,
      fs.realpathSync.native(directory)
    );
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("发布运行目录越过可信根目录");
    }
  }
  return resolved;
}

function readActivationLockOwner(lockDirectory) {
  const stat = fs.lstatSync(lockDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("发布互斥锁目录不可信");
  }
  const ownerPath = path.join(lockDirectory, ACTIVATION_LOCK_OWNER);
  const ownerStat = fs.lstatSync(ownerPath);
  if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) {
    throw new Error("发布互斥锁信息不可信");
  }
  const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
  if (
    !owner ||
    typeof owner !== "object" ||
    Array.isArray(owner) ||
    Object.keys(owner).length !== 3 ||
    !["pid", "startedAt", "token"].every((key) =>
      Object.hasOwn(owner, key)
    ) ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0 ||
    typeof owner.token !== "string" ||
    !/^[a-f0-9-]{36}$/.test(owner.token) ||
    typeof owner.startedAt !== "string" ||
    Number.isNaN(Date.parse(owner.startedAt)) ||
    new Date(owner.startedAt).toISOString() !== owner.startedAt
  ) {
    throw new Error("发布互斥锁信息无效");
  }
  return owner;
}

function processIsRunning(pid) {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function staleActivationLockToken(lockDirectory) {
  const stat = fs.lstatSync(lockDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("发布互斥锁目录不可信");
  }
  let owner;
  try {
    owner = readActivationLockOwner(lockDirectory);
  } catch (error) {
    const age = Date.now() - stat.mtimeMs;
    if (age < ACTIVATION_LOCK_INITIALIZATION_GRACE_MS) {
      throw new Error("发布互斥锁正在初始化");
    }
    return crypto.randomUUID();
  }
  const age = Date.now() - Date.parse(owner.startedAt);
  if (processIsRunning(owner.pid) && age <= ACTIVATION_LOCK_MAX_AGE_MS) {
    throw new Error("另一项发布切换正在进行");
  }
  return crypto.randomUUID();
}

function acquireActivationLock(runtimeDirectory) {
  const lockDirectory = path.join(runtimeDirectory, ACTIVATION_LOCK_NAME);
  assertDirectChild(runtimeDirectory, lockDirectory);
  let staleLockCleanupPending = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.mkdirSync(lockDirectory);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const staleToken = staleActivationLockToken(lockDirectory);
      const retiredLock = path.join(
        runtimeDirectory,
        `.activation-lock-stale-${staleToken}`
      );
      assertDirectChild(runtimeDirectory, retiredLock);
      try {
        fs.renameSync(lockDirectory, retiredLock);
      } catch (renameError) {
        if (renameError?.code === "ENOENT") continue;
        throw renameError;
      }
      try {
        fs.rmSync(retiredLock, { recursive: true, force: true });
      } catch {
        staleLockCleanupPending = true;
      }
      continue;
    }
  }
  if (!fs.existsSync(lockDirectory)) {
    throw new Error("无法取得发布互斥锁");
  }
  const token = crypto.randomUUID();
  try {
    fs.writeFileSync(
      path.join(lockDirectory, ACTIVATION_LOCK_OWNER),
      `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        token
      })}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  } catch (error) {
    fs.rmSync(lockDirectory, { recursive: true, force: true });
    throw error;
  }
  const releaseInternal = () => {
    if (!fs.existsSync(lockDirectory)) {
      return { cleanupPending: false, errorCode: null };
    }
    try {
      assertDirectChild(runtimeDirectory, lockDirectory);
      const owner = readActivationLockOwner(lockDirectory);
      if (owner.token !== token || owner.pid !== process.pid) {
        return { cleanupPending: true, errorCode: "OWNER_CHANGED" };
      }
      fs.rmSync(lockDirectory, { recursive: true, force: true });
      return { cleanupPending: false, errorCode: null };
    } catch (error) {
      return {
        cleanupPending: true,
        errorCode:
          typeof error?.code === "string" && error.code
            ? error.code
            : "UNKNOWN"
      };
    }
  };
  const exitCleanup = () => {
    releaseInternal();
  };
  process.once("exit", exitCleanup);
  let released = false;
  return {
    staleLockCleanupPending,
    release() {
      if (released) {
        return { cleanupPending: false, errorCode: null };
      }
      released = true;
      const result = releaseInternal();
      if (!result.cleanupPending) {
        process.removeListener("exit", exitCleanup);
      }
      return result;
    }
  };
}

function atomicWriteRuntimeFile(runtimeDirectory, filePath, contents) {
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  const backup = path.join(
    runtimeDirectory,
    `.local-release-trust-backup-${crypto.randomUUID()}`
  );
  assertDirectChild(runtimeDirectory, backup);
  fs.writeFileSync(temporary, contents, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  let movedExisting = false;
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("本地发布证书覆盖层不是可信文件");
      }
      fs.renameSync(filePath, backup);
      movedExisting = true;
    }
    fs.renameSync(temporary, filePath);
    if (movedExisting) fs.rmSync(backup, { force: true });
  } catch (error) {
    if (!fs.existsSync(filePath) && movedExisting && fs.existsSync(backup)) {
      fs.renameSync(backup, filePath);
    }
    throw error;
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function trustedCurrentClientConfig(runtimeDirectory) {
  const current = path.join(runtimeDirectory, "current");
  assertDirectChild(runtimeDirectory, current);
  const currentStat = fs.lstatSync(current);
  if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) {
    throw new Error("当前发布目录不是可信目录");
  }
  const realRuntime = fs.realpathSync.native(runtimeDirectory);
  const realCurrent = fs.realpathSync.native(current);
  if (path.relative(realRuntime, realCurrent) !== "current") {
    throw new Error("当前发布目录越过可信运行目录");
  }
  const clientConfig = path.join(current, "client-config");
  const clientConfigStat = fs.lstatSync(clientConfig);
  if (!clientConfigStat.isDirectory() || clientConfigStat.isSymbolicLink()) {
    throw new Error("本地发布证书覆盖层目录不可信");
  }
  if (
    path.relative(
      realCurrent,
      fs.realpathSync.native(clientConfig)
    ) !== "client-config"
  ) {
    throw new Error("本地发布证书覆盖层越过当前发布目录");
  }
  return { current, clientConfig };
}

function writeLocalReleaseTrustOverlay({ runtimeDirectory, trust }) {
  const normalizedTrust = validateLocalReleaseTrust(trust);
  const runtime = ensureRuntime(runtimeDirectory);
  const lock = acquireActivationLock(runtime);
  let result;
  let failure = null;
  let previousTrustBackup = null;
  let trustPath = null;
  try {
    const { current, clientConfig } = trustedCurrentClientConfig(runtime);
    trustPath = path.join(clientConfig, "local-release-trust.json");
    if (fs.existsSync(trustPath)) {
      const trustStat = fs.lstatSync(trustPath);
      if (!trustStat.isFile() || trustStat.isSymbolicLink()) {
        throw new Error("本地发布证书覆盖层不是可信文件");
      }
      previousTrustBackup = path.join(
        runtime,
        `.local-release-trust-backup-${crypto.randomUUID()}`
      );
      assertDirectChild(runtime, previousTrustBackup);
      fs.renameSync(trustPath, previousTrustBackup);
    }
    verifyReleaseBundle({
      bundleDirectory: current,
      allowCatalogPolicyDrift: true
    });
    atomicWriteRuntimeFile(
      runtime,
      trustPath,
      `${JSON.stringify(normalizedTrust, null, 2)}\n`
    );
    verifyReleaseBundle({
      bundleDirectory: current,
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
    result = normalizedTrust;
  } catch (error) {
    try {
      if (trustPath && fs.existsSync(trustPath)) {
        const trustStat = fs.lstatSync(trustPath);
        if (!trustStat.isFile() || trustStat.isSymbolicLink()) {
          throw new Error("失败的本地发布证书覆盖层不是可信文件");
        }
        fs.rmSync(trustPath, { force: true });
      }
      if (previousTrustBackup && fs.existsSync(previousTrustBackup)) {
        fs.renameSync(previousTrustBackup, trustPath);
      }
    } catch (restoreError) {
      failure = new AggregateError(
        [error, restoreError],
        "本地发布证书固定失败且旧配置恢复失败"
      );
    }
    if (!failure) failure = error;
  }
  if (!failure && previousTrustBackup) {
    try {
      fs.rmSync(previousTrustBackup, { force: true });
    } catch (error) {
      failure = error;
    }
  }
  const lockCleanup = lock.release();
  if (failure) {
    failure.activationLockCleanup = lockCleanup;
    throw failure;
  }
  return {
    ...result,
    staleLockCleanupPending: lock.staleLockCleanupPending,
    activationLockCleanupPending: lockCleanup.cleanupPending,
    activationLockCleanupErrorCode: lockCleanup.errorCode
  };
}

function uniqueNamedDirectory(parent, baseName, pattern) {
  for (let index = 1; index <= 999; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidateName = `${baseName.slice(
      0,
      Math.max(1, 121 - suffix.length)
    )}${suffix}`;
    if (!pattern.test(candidateName)) continue;
    const candidate = path.join(parent, candidateName);
    if (!fs.existsSync(candidate)) {
      return { name: candidateName, directory: candidate };
    }
  }
  throw new Error("无法创建唯一的发布目录名称");
}

function copyVerifiedBundle(
  source,
  destination,
  {
    allowCatalogPolicyDrift = false,
    allowLocalRuntimeTrust = false
  } = {}
) {
  if (fs.existsSync(destination)) {
    throw new Error("目标备份已存在");
  }
  try {
    fs.cpSync(source, destination, {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  } catch (copyError) {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    throw copyError;
  }
  try {
    return verifyReleaseBundle({
      bundleDirectory: destination,
      allowCatalogPolicyDrift,
      allowLocalRuntimeTrust
    });
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

function moveVerifiedBundle(
  source,
  destination,
  {
    allowCatalogPolicyDrift = false,
    allowLocalRuntimeTrust = false
  } = {}
) {
  const verified = verifyReleaseBundle({
    bundleDirectory: source,
    allowCatalogPolicyDrift,
    allowLocalRuntimeTrust
  });
  const transfer = movePreparedBundle(source, destination);
  if (!transfer.copied) return verified;
  try {
    const copiedVerification = verifyReleaseBundle({
      bundleDirectory: destination,
      allowCatalogPolicyDrift,
      allowLocalRuntimeTrust
    });
    fs.rmSync(source, { recursive: true, force: true });
    return copiedVerification;
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

function movePreparedBundle(source, destination) {
  try {
    fs.renameSync(source, destination);
    return { copied: false };
  } catch (error) {
    if (!["EPERM", "EXDEV"].includes(error?.code)) throw error;
    if (fs.existsSync(destination)) {
      throw new Error("发布目标目录已存在");
    }
    try {
      fs.cpSync(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false
      });
    } catch (copyError) {
      if (fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
      }
      throw copyError;
    }
    return { copied: true };
  }
}

function archiveCurrent(
  runtimeDirectory,
  prefix,
  now,
  { alreadyVerified = false } = {}
) {
  const current = path.join(runtimeDirectory, "current");
  if (!fs.existsSync(current)) return null;
  if (!alreadyVerified) {
    verifyReleaseBundle({
      bundleDirectory: current,
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
  }
  const backups = path.join(runtimeDirectory, "backups");
  const target = uniqueNamedDirectory(
    backups,
    `${prefix}-${compactTimestamp(now)}-${releaseLabel(current)}`,
    BACKUP_NAME
  );
  const { name: backupName, directory: backup } = target;
  const transfer = movePreparedBundle(current, backup);
  if (transfer.copied) {
    try {
      verifyReleaseBundle({
        bundleDirectory: backup,
        allowCatalogPolicyDrift: true,
        allowLocalRuntimeTrust: true
      });
      fs.rmSync(current, { recursive: true, force: true });
    } catch (error) {
      fs.rmSync(backup, { recursive: true, force: true });
      throw error;
    }
  }
  return { backup, backupName };
}

function retireIncompatibleCurrent(runtimeDirectory, now) {
  const current = path.join(runtimeDirectory, "current");
  const stat = fs.lstatSync(current);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("当前发布目录不是可信目录");
  }
  const target = uniqueNamedDirectory(
    path.join(runtimeDirectory, "staging"),
    `discard-${compactTimestamp(now)}`,
    DISCARD_NAME
  );
  assertDirectChild(path.join(runtimeDirectory, "staging"), target.directory);
  fs.renameSync(current, target.directory);
  return target.directory;
}

function discardRetiredCurrent(runtimeDirectory, retiredDirectory) {
  assertDirectChild(path.join(runtimeDirectory, "staging"), retiredDirectory);
  const stat = fs.lstatSync(retiredDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("待丢弃的旧发布目录不是可信目录");
  }
  fs.rmSync(retiredDirectory, { recursive: true, force: true });
}

function removeFailedActivation(runtimeDirectory) {
  const current = path.join(runtimeDirectory, "current");
  if (!fs.existsSync(current)) return;
  assertDirectChild(runtimeDirectory, current);
  const stat = fs.lstatSync(current);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(current);
    return;
  }
  if (!stat.isDirectory()) {
    throw new Error("失败的发布目标不是可信目录");
  }
  fs.rmSync(current, { recursive: true, force: true });
}

function removeStagedCandidateBestEffort(runtimeDirectory, stagedBundleDirectory) {
  try {
    const stagingRoot = path.join(runtimeDirectory, "staging");
    const staged = path.resolve(stagedBundleDirectory);
    assertDirectChild(stagingRoot, staged);
    if (!fs.existsSync(staged)) {
      return { cleanupPending: false, errorCode: null };
    }
    const stat = fs.lstatSync(staged);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fs.unlinkSync(staged);
    } else {
      fs.rmSync(staged, { recursive: true, force: true });
    }
    return { cleanupPending: false, errorCode: null };
  } catch (error) {
    return {
      cleanupPending: true,
      errorCode:
        typeof error?.code === "string" && error.code ? error.code : "UNKNOWN"
    };
  }
}

function assertActivationVersionPolicy({
  currentBundleDirectory,
  currentVerification,
  stagedBundleDirectory,
  stagedVerification,
  allowVersionRegression
}) {
  if (allowVersionRegression || !currentVerification) return;
  const comparison = compareVersions(
    stagedVerification.updateVersion,
    currentVerification.updateVersion
  );
  if (comparison < 0) {
    throw new Error("发布版本倒退；只有显式备份恢复可以安装旧版本");
  }
  if (comparison > 0) return;
  const currentManifest = readManifest(currentBundleDirectory);
  const stagedManifest = readManifest(stagedBundleDirectory);
  const normalizedBuildIdentity = (verification) => ({
    source: verification.source,
    builtAt: verification.builtAt,
    artifacts: Array.isArray(verification.buildArtifacts)
      ? verification.buildArtifacts
          .map((entry) => ({
            name: entry.name,
            sha256: entry.sha256,
            fileSize: entry.fileSize
          }))
          .sort((left, right) => left.name.localeCompare(right.name))
      : null
  });
  if (
    currentManifest.update.sha256 !== stagedManifest.update.sha256 ||
    !currentVerification.source ||
    !stagedVerification.source ||
    !currentVerification.builtAt ||
    !stagedVerification.builtAt ||
    !Array.isArray(currentVerification.buildArtifacts) ||
    !Array.isArray(stagedVerification.buildArtifacts) ||
    JSON.stringify(normalizedBuildIdentity(currentVerification)) !==
      JSON.stringify(normalizedBuildIdentity(stagedVerification))
  ) {
    throw new Error("同版本发布内容不一致；必须提升版本号后重新发布");
  }
}

function restorePreviousCurrent(runtimeDirectory, archived, retired) {
  const current = path.join(runtimeDirectory, "current");
  if (archived?.backup) {
    moveVerifiedBundle(archived.backup, current, {
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
  } else if (retired) {
    fs.renameSync(retired, current);
  }
}

function activateStagedBundleLocked({
  runtimeDirectory,
  stagedBundleDirectory,
  allowLegacyV1Migration = false,
  retainPreviousRelease = false,
  allowVersionRegression = false,
  now = new Date()
}) {
  const runtime = path.resolve(runtimeDirectory);
  const staged = path.resolve(stagedBundleDirectory);
  assertDirectChild(path.join(runtime, "staging"), staged);
  const stagedVerification = verifyReleaseBundle({ bundleDirectory: staged });
  let archived = null;
  let retired = null;
  let newCurrentActivated = false;
  let stagingCleanupPending = false;
  let verified;
  try {
    const current = path.join(runtime, "current");
    let currentVerification = null;
    let currentIsLegacyV1 = false;
    if (fs.existsSync(current)) {
      currentVerification = allowLegacyV1Migration
        ? verifyMigratableReleaseBundle({
            bundleDirectory: current,
            allowCatalogPolicyDrift: true,
            allowLocalRuntimeTrust: true
          })
        : verifyReleaseBundle({
          bundleDirectory: current,
          allowCatalogPolicyDrift: true,
          allowLocalRuntimeTrust: true
        });
      currentIsLegacyV1 = currentVerification.legacySchemaVersion === 1;
    }
    assertActivationVersionPolicy({
      currentBundleDirectory: current,
      currentVerification,
      stagedBundleDirectory: staged,
      stagedVerification,
      allowVersionRegression
    });
    if (currentIsLegacyV1) {
      retired = retireIncompatibleCurrent(runtime, now);
    }
    if (!retired) {
      archived = archiveCurrent(runtime, "auto", now, {
        alreadyVerified: true
      });
    }
    const transfer = movePreparedBundle(
      staged,
      path.join(runtime, "current")
    );
    newCurrentActivated = true;
    verified = verifyReleaseBundle({
      bundleDirectory: path.join(runtime, "current")
    });
    if (transfer.copied) {
      try {
        fs.rmSync(staged, { recursive: true, force: true });
      } catch {
        stagingCleanupPending = true;
      }
    }
  } catch (error) {
    try {
      if (newCurrentActivated) removeFailedActivation(runtime);
      restorePreviousCurrent(runtime, archived, retired);
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        "发布切换失败且旧版本恢复失败"
      );
    }
    throw error;
  }
  const current = path.join(runtime, "current");
  let retiredCleanupPending = false;
  if (retired && !retainPreviousRelease) {
    try {
      discardRetiredCurrent(runtime, retired);
    } catch {
      retiredCleanupPending = true;
    }
  }
  return {
    current,
    backupName: archived?.backupName || "",
    retiredName:
      retired && retainPreviousRelease ? path.basename(retired) : "",
    migratedLegacyCurrent: Boolean(retired),
    discardedIncompatibleCurrent:
      Boolean(retired) && !retainPreviousRelease && !retiredCleanupPending,
    retiredCleanupPending,
    stagingCleanupPending,
    ...verified
  };
}

function activateStagedBundleWithPolicy(options, allowVersionRegression) {
  const runtime = ensureRuntime(options.runtimeDirectory);
  let lock;
  try {
    lock = acquireActivationLock(runtime);
  } catch (error) {
    error.stagingCleanup = removeStagedCandidateBestEffort(
      runtime,
      options.stagedBundleDirectory
    );
    throw error;
  }
  let result;
  let failure = null;
  try {
    result = activateStagedBundleLocked({
      ...options,
      runtimeDirectory: runtime,
      allowVersionRegression
    });
  } catch (error) {
    failure = error;
  }
  const lockCleanup = lock.release();
  if (failure) {
    failure.activationLockCleanup = lockCleanup;
    failure.stagingCleanup = removeStagedCandidateBestEffort(
      runtime,
      options.stagedBundleDirectory
    );
    throw failure;
  }
  return {
    ...result,
    staleLockCleanupPending: lock.staleLockCleanupPending,
    activationLockCleanupPending: lockCleanup.cleanupPending,
    activationLockCleanupErrorCode: lockCleanup.errorCode
  };
}

function activateStagedBundle(options) {
  return activateStagedBundleWithPolicy(options, false);
}

function verifiedTransactionPreviousRelease(
  runtimeDirectory,
  backupName = "",
  retiredName = "",
  { required = false } = {}
) {
  const normalizedBackupName = String(backupName || "");
  const normalizedRetiredName = String(retiredName || "");
  if (normalizedBackupName && normalizedRetiredName) {
    throw new Error("发布事务只能保留一个旧版本");
  }
  if (normalizedBackupName) {
    if (!AUTO_BACKUP_NAME.test(normalizedBackupName)) {
      throw new Error("发布事务自动备份名称无效");
    }
    const directory = path.join(
      runtimeDirectory,
      "backups",
      normalizedBackupName
    );
    assertDirectChild(path.join(runtimeDirectory, "backups"), directory);
    const verification = verifyReleaseBundle({
      bundleDirectory: directory,
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
    return {
      kind: "v2",
      name: normalizedBackupName,
      directory,
      verification
    };
  }
  if (normalizedRetiredName) {
    if (!DISCARD_NAME.test(normalizedRetiredName)) {
      throw new Error("发布事务旧版目录名称无效");
    }
    const directory = path.join(
      runtimeDirectory,
      "staging",
      normalizedRetiredName
    );
    assertDirectChild(path.join(runtimeDirectory, "staging"), directory);
    const verification = verifyLegacyReleaseBundleV1({
      bundleDirectory: directory,
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
    return {
      kind: "legacy-v1",
      name: normalizedRetiredName,
      directory,
      verification
    };
  }
  if (required) throw new Error("发布事务没有可恢复的旧版本");
  return null;
}

function assertExpectedActivatedRelease(
  runtimeDirectory,
  verification,
  expectedCurrent
) {
  if (!expectedCurrent) return;
  if (
    !expectedCurrent ||
    typeof expectedCurrent !== "object" ||
    Array.isArray(expectedCurrent) ||
    typeof expectedCurrent.version !== "string" ||
    !/^[0-9a-f]{64}$/.test(expectedCurrent.sha256 || "") ||
    !expectedCurrent.source ||
    typeof expectedCurrent.source !== "object" ||
    Array.isArray(expectedCurrent.source)
  ) {
    throw new Error("发布事务当前版本凭据无效");
  }
  const manifest = readManifest(path.join(runtimeDirectory, "current"));
  if (
    verification.updateVersion !== expectedCurrent.version ||
    manifest.update.sha256 !== expectedCurrent.sha256 ||
    JSON.stringify(verification.source) !==
      JSON.stringify(expectedCurrent.source)
  ) {
    throw new Error("当前发布与事务凭据不一致");
  }
}

function finalizeActivatedRelease({
  runtimeDirectory,
  backupName = "",
  retiredName = "",
  expectedCurrent = null
}) {
  const runtime = ensureRuntime(runtimeDirectory);
  const lock = acquireActivationLock(runtime);
  let result;
  let failure = null;
  try {
    const currentVerification = verifyReleaseBundle({
      bundleDirectory: path.join(runtime, "current"),
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
    assertExpectedActivatedRelease(
      runtime,
      currentVerification,
      expectedCurrent
    );
    const previous = verifiedTransactionPreviousRelease(
      runtime,
      backupName,
      retiredName
    );
    let cleanupPending = false;
    let cleanupErrorCode = null;
    if (previous) {
      try {
        fs.rmSync(previous.directory, { recursive: true, force: true });
      } catch (error) {
        cleanupPending = true;
        cleanupErrorCode =
          typeof error?.code === "string" && error.code
            ? error.code
            : "UNKNOWN";
      }
    }
    result = {
      finalized: true,
      previousReleaseKind: previous?.kind || "none",
      cleanupPending,
      cleanupErrorCode,
      ...currentVerification
    };
  } catch (error) {
    failure = error;
  }
  const lockCleanup = lock.release();
  if (failure) {
    failure.activationLockCleanup = lockCleanup;
    throw failure;
  }
  return {
    ...result,
    staleLockCleanupPending: lock.staleLockCleanupPending,
    activationLockCleanupPending: lockCleanup.cleanupPending,
    activationLockCleanupErrorCode: lockCleanup.errorCode
  };
}

function rollbackActivatedRelease({
  runtimeDirectory,
  backupName = "",
  retiredName = "",
  expectedCurrent = null,
  now = new Date()
}) {
  const runtime = ensureRuntime(runtimeDirectory);
  const lock = acquireActivationLock(runtime);
  let result;
  let failure = null;
  try {
    const current = path.join(runtime, "current");
    const currentVerification = verifyReleaseBundle({
      bundleDirectory: current,
      allowCatalogPolicyDrift: true,
      allowLocalRuntimeTrust: true
    });
    assertExpectedActivatedRelease(
      runtime,
      currentVerification,
      expectedCurrent
    );
    const previous = verifiedTransactionPreviousRelease(
      runtime,
      backupName,
      retiredName
    );
    const failedCurrent = retireIncompatibleCurrent(runtime, now);
    if (!previous) {
      let cleanupPending = false;
      let cleanupErrorCode = null;
      try {
        discardRetiredCurrent(runtime, failedCurrent);
      } catch (error) {
        cleanupPending = true;
        cleanupErrorCode =
          typeof error?.code === "string" && error.code
            ? error.code
            : "UNKNOWN";
      }
      result = {
        rolledBack: true,
        restoredReleaseKind: "none",
        cleanupPending,
        cleanupErrorCode
      };
    } else {
      let previousMoved = false;
      try {
        fs.renameSync(previous.directory, current);
        previousMoved = true;
        const restoredVerification =
          previous.kind === "legacy-v1"
            ? verifyLegacyReleaseBundleV1({
                bundleDirectory: current,
                allowCatalogPolicyDrift: true,
                allowLocalRuntimeTrust: true
              })
            : verifyReleaseBundle({
                bundleDirectory: current,
                allowCatalogPolicyDrift: true,
                allowLocalRuntimeTrust: true
              });
        let cleanupPending = false;
        let cleanupErrorCode = null;
        try {
          discardRetiredCurrent(runtime, failedCurrent);
        } catch (error) {
          cleanupPending = true;
          cleanupErrorCode =
            typeof error?.code === "string" && error.code
              ? error.code
              : "UNKNOWN";
        }
        result = {
          rolledBack: true,
          restoredReleaseKind: previous.kind,
          cleanupPending,
          cleanupErrorCode,
          ...restoredVerification
        };
      } catch (error) {
        try {
          if (previousMoved && fs.existsSync(current)) {
            fs.renameSync(current, previous.directory);
          }
          if (fs.existsSync(failedCurrent)) {
            fs.renameSync(failedCurrent, current);
          }
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            "发布回滚失败且新版本恢复失败"
          );
        }
        throw error;
      }
    }
  } catch (error) {
    failure = error;
  }
  const lockCleanup = lock.release();
  if (failure) {
    failure.activationLockCleanup = lockCleanup;
    throw failure;
  }
  return {
    ...result,
    staleLockCleanupPending: lock.staleLockCleanupPending,
    activationLockCleanupPending: lockCleanup.cleanupPending,
    activationLockCleanupErrorCode: lockCleanup.errorCode
  };
}

function createManualBackup({ runtimeDirectory, now = new Date() }) {
  const runtime = ensureRuntime(runtimeDirectory);
  const lock = acquireActivationLock(runtime);
  let result;
  let failure = null;
  try {
    const current = path.join(runtime, "current");
    verifyReleaseBundle({
      bundleDirectory: current,
      allowLocalRuntimeTrust: true
    });
    const target = uniqueNamedDirectory(
      path.join(runtime, "backups"),
      `manual-${compactTimestamp(now)}-${releaseLabel(current)}`,
      BACKUP_NAME
    );
    const { name: backupName, directory: destination } = target;
    const verified = copyVerifiedBundle(current, destination, {
      allowLocalRuntimeTrust: true
    });
    result = {
      backupName,
      backupDirectory: destination,
      ...verified
    };
  } catch (error) {
    failure = error;
  }
  const lockCleanup = lock.release();
  if (failure) {
    failure.activationLockCleanup = lockCleanup;
    throw failure;
  }
  return {
    ...result,
    staleLockCleanupPending: lock.staleLockCleanupPending,
    activationLockCleanupPending: lockCleanup.cleanupPending,
    activationLockCleanupErrorCode: lockCleanup.errorCode
  };
}

function listBackups(runtimeDirectory) {
  const runtime = ensureRuntime(runtimeDirectory);
  return fs
    .readdirSync(path.join(runtime, "backups"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BACKUP_NAME.test(entry.name))
    .map((entry) => {
      const directory = path.join(runtime, "backups", entry.name);
      return {
        name: entry.name,
        directory,
        ...verifyReleaseBundle({
          bundleDirectory: directory,
          allowCatalogPolicyDrift: true,
          allowLocalRuntimeTrust: true
        })
      };
    })
    .sort((left, right) => right.name.localeCompare(left.name));
}

function restoreBackup({
  runtimeDirectory,
  backupName,
  now = new Date()
}) {
  if (!BACKUP_NAME.test(backupName)) throw new Error("备份名称无效");
  const runtime = ensureRuntime(runtimeDirectory);
  const backup = path.join(runtime, "backups", backupName);
  assertDirectChild(path.join(runtime, "backups"), backup);
  verifyReleaseBundle({
    bundleDirectory: backup,
    allowLocalRuntimeTrust: true
  });
  const stagedTarget = uniqueNamedDirectory(
    path.join(runtime, "staging"),
    `restore-${compactTimestamp(now)}`,
    /^restore-\d{8}T\d{6}Z(?:-\d{1,3})?$/
  );
  const staged = stagedTarget.directory;
  assertDirectChild(path.join(runtime, "staging"), staged);
  copyVerifiedBundle(backup, staged, {
    allowLocalRuntimeTrust: true
  });
  fs.rmSync(
    path.join(staged, "client-config", "local-release-trust.json"),
    { force: true }
  );
  return activateStagedBundleWithPolicy(
    {
      runtimeDirectory: runtime,
      stagedBundleDirectory: staged,
      now
    },
    true
  );
}

module.exports = {
  activateStagedBundle,
  createManualBackup,
  discardStagedBundleCandidateBestEffort:
    removeStagedCandidateBestEffort,
  finalizeActivatedRelease,
  listBackups,
  rollbackActivatedRelease,
  restoreBackup,
  writeLocalReleaseTrustOverlay
};
