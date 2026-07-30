"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  verifyReleaseBundle
} = require("./release-bundle-verifier.cjs");

const BACKUP_NAME = /^(?:auto|manual)-\d{8}T\d{6}Z-[a-z0-9][a-z0-9._-]{2,120}$/;

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

function ensureRuntime(runtimeDirectory) {
  const resolved = path.resolve(runtimeDirectory);
  fs.mkdirSync(path.join(resolved, "backups"), { recursive: true });
  fs.mkdirSync(path.join(resolved, "staging"), { recursive: true });
  return resolved;
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

function copyVerifiedBundle(source, destination) {
  if (fs.existsSync(destination)) {
    throw new Error("目标备份已存在");
  }
  fs.cpSync(source, destination, {
    recursive: true,
    errorOnExist: true,
    force: false
  });
  try {
    verifyReleaseBundle({ bundleDirectory: destination });
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

function moveVerifiedBundle(source, destination) {
  verifyReleaseBundle({ bundleDirectory: source });
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (!["EPERM", "EXDEV"].includes(error?.code)) throw error;
    copyVerifiedBundle(source, destination);
    fs.rmSync(source, { recursive: true, force: true });
  }
}

function archiveCurrent(runtimeDirectory, prefix, now) {
  const current = path.join(runtimeDirectory, "current");
  if (!fs.existsSync(current)) return null;
  verifyReleaseBundle({ bundleDirectory: current });
  const backups = path.join(runtimeDirectory, "backups");
  const target = uniqueNamedDirectory(
    backups,
    `${prefix}-${compactTimestamp(now)}-${releaseLabel(current)}`,
    BACKUP_NAME
  );
  const { name: backupName, directory: backup } = target;
  moveVerifiedBundle(current, backup);
  return { backup, backupName };
}

function activateStagedBundle({
  runtimeDirectory,
  stagedBundleDirectory,
  now = new Date()
}) {
  const runtime = ensureRuntime(runtimeDirectory);
  const staged = path.resolve(stagedBundleDirectory);
  assertDirectChild(path.join(runtime, "staging"), staged);
  verifyReleaseBundle({ bundleDirectory: staged });
  let archived = null;
  try {
    archived = archiveCurrent(runtime, "auto", now);
    moveVerifiedBundle(staged, path.join(runtime, "current"));
  } catch (error) {
    const current = path.join(runtime, "current");
    if (!fs.existsSync(current) && archived?.backup) {
      moveVerifiedBundle(archived.backup, current);
    }
    throw error;
  }
  const current = path.join(runtime, "current");
  const verified = verifyReleaseBundle({ bundleDirectory: current });
  return {
    current,
    backupName: archived?.backupName || "",
    ...verified
  };
}

function createManualBackup({ runtimeDirectory, now = new Date() }) {
  const runtime = ensureRuntime(runtimeDirectory);
  const current = path.join(runtime, "current");
  verifyReleaseBundle({ bundleDirectory: current });
  const target = uniqueNamedDirectory(
    path.join(runtime, "backups"),
    `manual-${compactTimestamp(now)}-${releaseLabel(current)}`,
    BACKUP_NAME
  );
  const { name: backupName, directory: destination } = target;
  copyVerifiedBundle(current, destination);
  return {
    backupName,
    backupDirectory: destination,
    ...verifyReleaseBundle({ bundleDirectory: destination })
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
        ...verifyReleaseBundle({ bundleDirectory: directory })
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
  verifyReleaseBundle({ bundleDirectory: backup });
  const stagedTarget = uniqueNamedDirectory(
    path.join(runtime, "staging"),
    `restore-${compactTimestamp(now)}`,
    /^restore-\d{8}T\d{6}Z(?:-\d{1,3})?$/
  );
  const staged = stagedTarget.directory;
  assertDirectChild(path.join(runtime, "staging"), staged);
  copyVerifiedBundle(backup, staged);
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
