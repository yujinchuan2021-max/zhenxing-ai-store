"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  verifyLegacyReleaseBundleV1,
  verifyReleaseBundle
} = require("./release-bundle-verifier.cjs");

const BACKUP_NAME = /^(?:auto|manual)-\d{8}T\d{6}Z-[a-z0-9][a-z0-9._-]{2,120}$/;
const DISCARD_NAME = /^discard-\d{8}T\d{6}Z(?:-\d{1,3})?$/;
const ACTIVATION_LOCK_NAME = ".activation-lock";
const ACTIVATION_LOCK_OWNER = "owner.json";
const ACTIVATION_LOCK_INITIALIZATION_GRACE_MS = 30_000;
const ACTIVATION_LOCK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

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
  now = new Date()
}) {
  const runtime = path.resolve(runtimeDirectory);
  const staged = path.resolve(stagedBundleDirectory);
  assertDirectChild(path.join(runtime, "staging"), staged);
  verifyReleaseBundle({ bundleDirectory: staged });
  let archived = null;
  let retired = null;
  let newCurrentActivated = false;
  let stagingCleanupPending = false;
  let verified;
  try {
    const current = path.join(runtime, "current");
    if (fs.existsSync(current)) {
      try {
        verifyReleaseBundle({
          bundleDirectory: current,
          allowCatalogPolicyDrift: true,
          allowLocalRuntimeTrust: true
        });
      } catch (error) {
        if (!allowLegacyV1Migration) throw error;
        verifyLegacyReleaseBundleV1({
          bundleDirectory: current,
          allowCatalogPolicyDrift: true,
          allowLocalRuntimeTrust: true
        });
        retired = retireIncompatibleCurrent(runtime, now);
      }
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
  if (retired) {
    try {
      discardRetiredCurrent(runtime, retired);
    } catch {
      retiredCleanupPending = true;
    }
  }
  return {
    current,
    backupName: archived?.backupName || "",
    migratedLegacyCurrent: Boolean(retired),
    discardedIncompatibleCurrent:
      Boolean(retired) && !retiredCleanupPending,
    retiredCleanupPending,
    stagingCleanupPending,
    ...verified
  };
}

function activateStagedBundle(options) {
  const runtime = ensureRuntime(options.runtimeDirectory);
  const lock = acquireActivationLock(runtime);
  let result;
  let failure = null;
  try {
    result = activateStagedBundleLocked({
      ...options,
      runtimeDirectory: runtime
    });
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
  return activateStagedBundle({
    runtimeDirectory: runtime,
    stagedBundleDirectory: staged,
    now
  });
}

module.exports = {
  activateStagedBundle,
  createManualBackup,
  listBackups,
  restoreBackup
};
