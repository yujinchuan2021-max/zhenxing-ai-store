"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  getExtensionRuntimeProfile
} = require("./extension-install-registry.cjs");

const RECEIPT_SCHEMA_VERSION = 1;
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const MAX_RECEIPT_BYTES = 64 * 1024;
const TARGET_ROOT_IDS = new Set(["user-data", "codex-skills"]);

function extensionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAbsoluteDirectory(root, label, fsApi = fs) {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw extensionError("EXTENSION_ROOT_INVALID", `${label} must be absolute`);
  }
  let stat;
  try {
    stat = fsApi.lstatSync(root);
  } catch {
    throw extensionError("EXTENSION_ROOT_MISSING", `${label} does not exist`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw extensionError(
      "EXTENSION_ROOT_UNSAFE",
      `${label} must be a real directory`
    );
  }
  return path.resolve(root);
}

function relativeSegments(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    path.posix.isAbsolute(value)
  ) {
    throw extensionError(
      "EXTENSION_PATH_INVALID",
      `${label} must be a relative path`
    );
  }
  const segments = value.split(/[\\/]+/);
  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw extensionError(
      "EXTENSION_PATH_INVALID",
      `${label} contains an unsafe segment`
    );
  }
  return segments;
}

function resolveWithin(root, value, label) {
  const candidate = path.resolve(root, ...relativeSegments(value, label));
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw extensionError(
      "EXTENSION_PATH_OUTSIDE_ROOT",
      `${label} escapes its approved root`
    );
  }
  return candidate;
}

function assertDirectorySnapshotProfile(profile) {
  if (
    !isPlainObject(profile) ||
    profile.adapterId !== "directory-snapshot" ||
    typeof profile.extensionId !== "string" ||
    !profile.extensionId ||
    typeof profile.hostProductId !== "string" ||
    !profile.hostProductId ||
    !TARGET_ROOT_IDS.has(profile.targetRootId)
  ) {
    throw extensionError(
      "EXTENSION_PROFILE_INVALID",
      "Extension profile is not an approved directory snapshot"
    );
  }
  relativeSegments(profile.sourcePath, "sourcePath");
  relativeSegments(profile.targetRelativePath, "targetRelativePath");
  return profile;
}

function assertTreeHasNoLinks(root, fsApi = fs) {
  const stat = fsApi.lstatSync(root);
  if (stat.isSymbolicLink()) {
    throw extensionError(
      "EXTENSION_SYMLINK_REJECTED",
      "Extension snapshots cannot contain symbolic links"
    );
  }
  if (stat.isFile()) return;
  if (!stat.isDirectory()) {
    throw extensionError(
      "EXTENSION_FILE_TYPE_REJECTED",
      "Extension snapshots can contain only files and directories"
    );
  }
  for (const entry of fsApi.readdirSync(root)) {
    assertTreeHasNoLinks(path.join(root, entry), fsApi);
  }
}

function assertExistingAncestorsHaveNoLinks(root, destination, fsApi = fs) {
  const relative = path.relative(root, destination);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fsApi.existsSync(current)) break;
    const stat = fsApi.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw extensionError(
        "EXTENSION_SYMLINK_REJECTED",
        "Extension target cannot pass through a symbolic link"
      );
    }
    if (!stat.isDirectory()) {
      throw extensionError(
        "EXTENSION_TARGET_INVALID",
        "Extension target parent is not a directory"
      );
    }
  }
}

function assertAbsoluteAncestorsHaveNoLinks(destination, fsApi = fs) {
  if (typeof destination !== "string" || !path.isAbsolute(destination)) {
    throw extensionError(
      "EXTENSION_ROOT_INVALID",
      "Extension target root must be absolute"
    );
  }
  const filesystemRoot = path.parse(destination).root;
  if (path.resolve(destination) === path.resolve(filesystemRoot)) {
    throw extensionError(
      "EXTENSION_ROOT_UNSAFE",
      "Extension target root cannot be a filesystem root"
    );
  }
  let current = filesystemRoot;
  for (const segment of path.relative(filesystemRoot, destination).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (!fsApi.existsSync(current)) break;
    const stat = fsApi.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw extensionError(
        "EXTENSION_SYMLINK_REJECTED",
        "Extension target root cannot pass through a symbolic link"
      );
    }
    if (!stat.isDirectory()) {
      throw extensionError(
        "EXTENSION_ROOT_UNSAFE",
        "Extension target root parent is not a directory"
      );
    }
  }
}

function ensureDirectoryWithoutLinks(destination, fsApi = fs) {
  assertAbsoluteAncestorsHaveNoLinks(destination, fsApi);
  fsApi.mkdirSync(destination, { recursive: true });
  assertAbsoluteAncestorsHaveNoLinks(destination, fsApi);
  const stat = fsApi.lstatSync(destination);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw extensionError(
      "EXTENSION_ROOT_UNSAFE",
      "Extension target root must be a real directory"
    );
  }
}

function createdParentDirectories(root, destination, fsApi = fs) {
  const missing = [];
  let current = path.dirname(destination);
  while (current !== root) {
    if (fsApi.existsSync(current)) break;
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      throw extensionError(
        "EXTENSION_PATH_OUTSIDE_ROOT",
        "Extension target escapes its approved root"
      );
    }
    current = parent;
  }
  return missing.reverse();
}

function copySnapshot(source, destination, fsApi = fs) {
  const stat = fsApi.lstatSync(source);
  if (stat.isSymbolicLink()) {
    throw extensionError(
      "EXTENSION_SYMLINK_REJECTED",
      "Extension snapshots cannot contain symbolic links"
    );
  }
  if (stat.isDirectory()) {
    fsApi.mkdirSync(destination);
    for (const entry of fsApi.readdirSync(source)) {
      copySnapshot(
        path.join(source, entry),
        path.join(destination, entry),
        fsApi
      );
    }
    return;
  }
  if (!stat.isFile()) {
    throw extensionError(
      "EXTENSION_FILE_TYPE_REJECTED",
      "Extension snapshots can contain only files and directories"
    );
  }
  fsApi.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}

function safeRemoveOwnedDirectory(target, fsApi = fs) {
  if (!fsApi.existsSync(target)) return;
  const stat = fsApi.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw extensionError(
      "EXTENSION_OWNED_PATH_UNSAFE",
      "Owned extension path changed to an unsafe file type"
    );
  }
  fsApi.rmSync(target, { recursive: true, force: false });
}

function writeJsonAtomic(filePath, value, fsApi = fs) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fsApi.writeFileSync(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    flag: "wx"
  });
  try {
    fsApi.renameSync(temporary, filePath);
  } catch (error) {
    try {
      fsApi.unlinkSync(temporary);
    } catch {}
    throw error;
  }
}

function createExtensionRuntime({
  resourcesRoot,
  userDataRoot,
  receiptsRoot = path.join(userDataRoot || "", "extension-receipts"),
  targetRoots = Object.freeze({}),
  fsApi = fs,
  profileLookup = getExtensionRuntimeProfile,
  now = () => new Date().toISOString()
}) {
  const approvedResourcesRoot = assertAbsoluteDirectory(
    resourcesRoot,
    "resourcesRoot",
    fsApi
  );
  const approvedUserDataRoot = assertAbsoluteDirectory(
    userDataRoot,
    "userDataRoot",
    fsApi
  );
  if (!isPlainObject(targetRoots)) {
    throw extensionError(
      "EXTENSION_ROOT_INVALID",
      "Extension target roots must be a local map"
    );
  }
  const approvedTargetRoots = { "user-data": approvedUserDataRoot };
  for (const [rootId, rootPath] of Object.entries(targetRoots)) {
    if (
      !TARGET_ROOT_IDS.has(rootId) ||
      rootId === "user-data" ||
      typeof rootPath !== "string" ||
      !path.isAbsolute(rootPath) ||
      rootPath.includes("\0")
    ) {
      throw extensionError(
        "EXTENSION_ROOT_INVALID",
        "Extension target root is not locally approved"
      );
    }
    approvedTargetRoots[rootId] = path.resolve(rootPath);
  }

  const normalizedReceiptsRoot = path.resolve(receiptsRoot);
  const receiptRelative = path.relative(
    approvedUserDataRoot,
    normalizedReceiptsRoot
  );
  if (
    receiptRelative === "" ||
    receiptRelative === ".." ||
    receiptRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(receiptRelative)
  ) {
    throw extensionError(
      "EXTENSION_RECEIPT_ROOT_INVALID",
      "Receipt storage must be a child of userDataRoot"
    );
  }
  function resolveProfile(profileId) {
    if (
      typeof profileId !== "string" ||
      !PROFILE_ID_PATTERN.test(profileId)
    ) {
      throw extensionError(
        "EXTENSION_PROFILE_NOT_APPROVED",
        "Extension profile is not locally approved"
      );
    }
    const profile = profileLookup(profileId);
    if (!profile) {
      throw extensionError(
        "EXTENSION_PROFILE_NOT_APPROVED",
        "Extension profile is not locally approved"
      );
    }
    const approvedProfile = assertDirectorySnapshotProfile(profile);
    if (!approvedTargetRoots[approvedProfile.targetRootId]) {
      throw extensionError(
        "EXTENSION_ROOT_UNAVAILABLE",
        "Approved extension target root is unavailable"
      );
    }
    return approvedProfile;
  }

  function receiptPath(profileId) {
    return path.join(normalizedReceiptsRoot, `${profileId}.json`);
  }

  function targetRoot(profile) {
    return approvedTargetRoots[profile.targetRootId];
  }

  function expectedTarget(profile) {
    return resolveWithin(
      targetRoot(profile),
      profile.targetRelativePath,
      "targetRelativePath"
    );
  }

  function validateReceipt(receipt, profileId, profile) {
    const target = expectedTarget(profile);
    const approvedTargetRoot = targetRoot(profile);
    if (
      !isPlainObject(receipt) ||
      receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
      receipt.profileId !== profileId ||
      receipt.adapterId !== profile.adapterId ||
      receipt.extensionId !== profile.extensionId ||
      receipt.hostProductId !== profile.hostProductId ||
      typeof receipt.installedAt !== "string" ||
      !Number.isFinite(Date.parse(receipt.installedAt)) ||
      !Array.isArray(receipt.ownedPaths) ||
      receipt.ownedPaths.length === 0 ||
      new Set(receipt.ownedPaths).size !== receipt.ownedPaths.length ||
      !receipt.ownedPaths.includes(target)
    ) {
      return null;
    }
    for (const ownedPath of receipt.ownedPaths) {
      if (typeof ownedPath !== "string" || !path.isAbsolute(ownedPath)) {
        return null;
      }
      const relativeToRoot = path.relative(approvedTargetRoot, ownedPath);
      const relativeToTarget = path.relative(ownedPath, target);
      if (
        relativeToRoot === "" ||
        relativeToRoot === ".." ||
        relativeToRoot.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeToRoot) ||
        (ownedPath !== target &&
          (relativeToTarget === "" ||
            relativeToTarget === ".." ||
            relativeToTarget.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeToTarget)))
      ) {
        return null;
      }
    }
    return receipt;
  }

  function readReceipt(profileId, profile) {
    const filePath = receiptPath(profileId);
    if (!fsApi.existsSync(filePath)) return { state: "missing", receipt: null };
    let stat;
    try {
      assertExistingAncestorsHaveNoLinks(
        approvedUserDataRoot,
        normalizedReceiptsRoot,
        fsApi
      );
      const receiptRootStat = fsApi.lstatSync(normalizedReceiptsRoot);
      if (
        receiptRootStat.isSymbolicLink() ||
        !receiptRootStat.isDirectory()
      ) {
        return { state: "invalid", receipt: null };
      }
      stat = fsApi.lstatSync(filePath);
    } catch {
      return { state: "invalid", receipt: null };
    }
    if (
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.size <= 0 ||
      stat.size > MAX_RECEIPT_BYTES
    ) {
      return { state: "invalid", receipt: null };
    }
    try {
      const parsed = JSON.parse(fsApi.readFileSync(filePath, "utf8"));
      const receipt = validateReceipt(parsed, profileId, profile);
      return receipt
        ? { state: "valid", receipt }
        : { state: "invalid", receipt: null };
    } catch {
      return { state: "invalid", receipt: null };
    }
  }

  function getReceipt(profileId) {
    const profile = resolveProfile(profileId);
    const result = readReceipt(profileId, profile);
    if (result.state === "invalid") {
      throw extensionError(
        "EXTENSION_RECEIPT_INVALID",
        "Extension receipt is invalid"
      );
    }
    return result.receipt ? structuredClone(result.receipt) : null;
  }

  function getStatus(profileId) {
    const profile = resolveProfile(profileId);
    const approvedTargetRoot = targetRoot(profile);
    const target = expectedTarget(profile);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") {
      return { state: "invalid-receipt", managed: false, targetPath: target };
    }
    if (fsApi.existsSync(approvedTargetRoot)) {
      const rootStat = fsApi.lstatSync(approvedTargetRoot);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        return { state: "unsafe", managed: false, targetPath: target };
      }
    }
    const targetExists = fsApi.existsSync(target);
    if (targetExists) {
      const stat = fsApi.lstatSync(target);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        return { state: "unsafe", managed: false, targetPath: target };
      }
    }
    if (!receiptResult.receipt) {
      return {
        state: targetExists ? "external" : "not-installed",
        managed: false,
        targetPath: target
      };
    }
    if (!targetExists) {
      return { state: "stale", managed: false, targetPath: target };
    }
    return { state: "installed", managed: true, targetPath: target };
  }

  function install(profileId) {
    const profile = resolveProfile(profileId);
    const approvedTargetRoot = targetRoot(profile);
    const source = resolveWithin(
      approvedResourcesRoot,
      profile.sourcePath,
      "sourcePath"
    );
    const target = expectedTarget(profile);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state !== "missing") {
      throw extensionError(
        "EXTENSION_ALREADY_MANAGED",
        "Extension already has a local receipt"
      );
    }
    if (!fsApi.existsSync(source)) {
      throw extensionError(
        "EXTENSION_SOURCE_MISSING",
        "Bundled extension snapshot is missing"
      );
    }
    const sourceStat = fsApi.lstatSync(source);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
      throw extensionError(
        "EXTENSION_SOURCE_INVALID",
        "Bundled extension snapshot must be a real directory"
      );
    }
    const canonicalResourcesRoot = fsApi.realpathSync(approvedResourcesRoot);
    const canonicalSource = fsApi.realpathSync(source);
    const sourceRelative = path.relative(
      canonicalResourcesRoot,
      canonicalSource
    );
    if (
      sourceRelative === "" ||
      sourceRelative === ".." ||
      sourceRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(sourceRelative)
    ) {
      throw extensionError(
        "EXTENSION_SOURCE_OUTSIDE_ROOT",
        "Bundled extension snapshot escapes resourcesRoot"
      );
    }
    assertTreeHasNoLinks(source, fsApi);
    ensureDirectoryWithoutLinks(approvedTargetRoot, fsApi);
    assertExistingAncestorsHaveNoLinks(
      approvedTargetRoot,
      path.dirname(target),
      fsApi
    );
    if (fsApi.existsSync(target)) {
      throw extensionError(
        "EXTENSION_TARGET_EXISTS",
        "Extension target already exists and will not be overwritten"
      );
    }

    const createdParents = createdParentDirectories(
      approvedTargetRoot,
      target,
      fsApi
    );
    const ownedPaths = [...createdParents, target];
    try {
      fsApi.mkdirSync(path.dirname(target), { recursive: true });
      assertExistingAncestorsHaveNoLinks(
        approvedTargetRoot,
        path.dirname(target),
        fsApi
      );
      copySnapshot(source, target, fsApi);
      const receipt = Object.freeze({
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        profileId,
        adapterId: profile.adapterId,
        extensionId: profile.extensionId,
        hostProductId: profile.hostProductId,
        installedAt: now(),
        ownedPaths
      });
      ensureDirectoryWithoutLinks(normalizedReceiptsRoot, fsApi);
      writeJsonAtomic(receiptPath(profileId), receipt, fsApi);
      return { state: "installed", receipt: structuredClone(receipt) };
    } catch (error) {
      if (fsApi.existsSync(target)) {
        try {
          safeRemoveOwnedDirectory(target, fsApi);
        } catch {}
      }
      for (const directory of createdParents.reverse()) {
        try {
          fsApi.rmdirSync(directory);
        } catch {}
      }
      throw error;
    }
  }

  function uninstall(profileId) {
    const profile = resolveProfile(profileId);
    const result = readReceipt(profileId, profile);
    if (result.state === "missing") return { state: "not-installed" };
    if (result.state === "invalid") {
      throw extensionError(
        "EXTENSION_RECEIPT_INVALID",
        "Extension receipt is invalid; no files were removed"
      );
    }
    const approvedTargetRoot = targetRoot(profile);
    const target = expectedTarget(profile);
    if (fsApi.existsSync(approvedTargetRoot)) {
      assertAbsoluteAncestorsHaveNoLinks(approvedTargetRoot, fsApi);
      assertExistingAncestorsHaveNoLinks(
        approvedTargetRoot,
        path.dirname(target),
        fsApi
      );
    }
    const parentPaths = result.receipt.ownedPaths
      .filter((ownedPath) => ownedPath !== target)
      .sort((left, right) => right.length - left.length);
    for (const ownedPath of [target, ...parentPaths]) {
      if (!fsApi.existsSync(ownedPath)) continue;
      const stat = fsApi.lstatSync(ownedPath);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw extensionError(
          "EXTENSION_OWNED_PATH_UNSAFE",
          "Owned extension path changed to an unsafe file type"
        );
      }
    }
    safeRemoveOwnedDirectory(target, fsApi);
    for (const directory of parentPaths) {
      if (!fsApi.existsSync(directory)) continue;
      try {
        fsApi.rmdirSync(directory);
      } catch (error) {
        if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
      }
    }
    fsApi.unlinkSync(receiptPath(profileId));
    return { state: "uninstalled" };
  }

  return Object.freeze({ getReceipt, getStatus, install, uninstall });
}

module.exports = {
  RECEIPT_SCHEMA_VERSION,
  assertDirectorySnapshotProfile,
  createExtensionRuntime,
  relativeSegments
};
