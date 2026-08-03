"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const {
  getExtensionRuntimeProfile
} = require("./extension-install-registry.cjs");

const RECEIPT_SCHEMA_VERSION = 2;
const LEGACY_RECEIPT_SCHEMA_VERSION = 1;
const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const TARGET_ROOT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_FILES = 4096;
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const SOURCE_METADATA_FILE = "AIHUB-SOURCE.json";

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

function canonicalRelativePath(value, label) {
  const segments = relativeSegments(value, label);
  const canonical = segments.join("/");
  if (value !== canonical) {
    throw extensionError(
      "EXTENSION_PATH_INVALID",
      `${label} must use canonical forward-slash separators`
    );
  }
  return canonical;
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

function normalizeSourceManifest(value) {
  if (
    !isPlainObject(value) ||
    typeof value.versionRef !== "string" ||
    value.versionRef.length === 0 ||
    value.versionRef.length > 256 ||
    value.versionRef.includes("\0") ||
    !isPlainObject(value.files)
  ) {
    throw extensionError(
      "EXTENSION_PROFILE_INVALID",
      "Extension profile must declare a pinned source manifest"
    );
  }
  const entries = Object.entries(value.files);
  if (entries.length === 0 || entries.length > MAX_MANIFEST_FILES) {
    throw extensionError(
      "EXTENSION_PROFILE_INVALID",
      "Extension source manifest has an invalid file count"
    );
  }
  const files = {};
  for (const [relativePath, hash] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    const canonical = canonicalRelativePath(relativePath, "sourceManifest file");
    if (typeof hash !== "string" || !SHA256_PATTERN.test(hash)) {
      throw extensionError(
        "EXTENSION_PROFILE_INVALID",
        `Extension source hash is invalid: ${canonical}`
      );
    }
    files[canonical] = hash;
  }
  return Object.freeze({
    versionRef: value.versionRef,
    files: Object.freeze(files)
  });
}

function assertDirectorySnapshotProfile(profile) {
  if (
    !isPlainObject(profile) ||
    profile.adapterId !== "directory-snapshot" ||
    typeof profile.extensionId !== "string" ||
    !profile.extensionId ||
    typeof profile.hostProductId !== "string" ||
    !profile.hostProductId ||
    typeof profile.targetRootId !== "string" ||
    !TARGET_ROOT_ID_PATTERN.test(profile.targetRootId)
  ) {
    throw extensionError(
      "EXTENSION_PROFILE_INVALID",
      "Extension profile is not an approved directory snapshot"
    );
  }
  canonicalRelativePath(profile.sourcePath, "sourcePath");
  canonicalRelativePath(profile.targetRelativePath, "targetRelativePath");
  normalizeSourceManifest(profile.sourceManifest);
  return profile;
}

function assertExistingAncestorsHaveNoLinks(root, destination, fsApi = fs) {
  const relative = path.relative(root, destination);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw extensionError(
      "EXTENSION_PATH_OUTSIDE_ROOT",
      "Extension target escapes its approved root"
    );
  }
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

function sha256(filePath, fsApi = fs) {
  return crypto
    .createHash("sha256")
    .update(fsApi.readFileSync(filePath))
    .digest("hex");
}

function scanDirectory(root, fsApi = fs, { excludeSourceMetadata = false } = {}) {
  const rootStat = fsApi.lstatSync(root);
  if (rootStat.isSymbolicLink()) {
    throw extensionError(
      "EXTENSION_SYMLINK_REJECTED",
      "Extension snapshots cannot contain symbolic links"
    );
  }
  if (!rootStat.isDirectory()) {
    throw extensionError(
      "EXTENSION_FILE_TYPE_REJECTED",
      "Extension snapshots must be real directories"
    );
  }
  const files = {};
  const directories = [];
  let fileCount = 0;

  function visit(directory, prefix) {
    for (const entry of fsApi.readdirSync(directory).sort()) {
      if (excludeSourceMetadata && prefix === "" && entry === SOURCE_METADATA_FILE) {
        continue;
      }
      const absolute = path.join(directory, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      const stat = fsApi.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throw extensionError(
          "EXTENSION_SYMLINK_REJECTED",
          "Extension snapshots cannot contain symbolic links"
        );
      }
      if (stat.isDirectory()) {
        directories.push(relative);
        visit(absolute, relative);
        continue;
      }
      if (!stat.isFile()) {
        throw extensionError(
          "EXTENSION_FILE_TYPE_REJECTED",
          "Extension snapshots can contain only files and directories"
        );
      }
      if (fileCount >= MAX_MANIFEST_FILES) {
        throw extensionError(
          "EXTENSION_MANIFEST_TOO_LARGE",
          "Extension snapshot contains too many files"
        );
      }
      files[relative] = sha256(absolute, fsApi);
      fileCount += 1;
    }
  }

  visit(root, "");
  return Object.freeze({
    files: Object.freeze(files),
    directories: Object.freeze(directories)
  });
}

function sameFiles(left, right) {
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) => key === rightKeys[index] && left[key] === right[key]
  );
}

function sameTree(left, right) {
  if (!left || !right || !sameFiles(left.files, right.files)) return false;
  if (!Array.isArray(left.directories) || !Array.isArray(right.directories)) {
    return false;
  }
  return (
    left.directories.length === right.directories.length &&
    left.directories.every((directory, index) => directory === right.directories[index])
  );
}

function copySnapshot(
  source,
  destination,
  fsApi = fs,
  { excludeSourceMetadata = false, root = source } = {}
) {
  const stat = fsApi.lstatSync(source);
  if (stat.isSymbolicLink()) {
    throw extensionError(
      "EXTENSION_SYMLINK_REJECTED",
      "Extension snapshots cannot contain symbolic links"
    );
  }
  if (stat.isDirectory()) {
    fsApi.mkdirSync(destination);
    for (const entry of fsApi.readdirSync(source).sort()) {
      if (
        excludeSourceMetadata &&
        path.resolve(source) === path.resolve(root) &&
        entry === SOURCE_METADATA_FILE
      ) {
        continue;
      }
      copySnapshot(path.join(source, entry), path.join(destination, entry), fsApi, {
        excludeSourceMetadata,
        root
      });
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
  const nonce = crypto.randomBytes(8).toString("hex");
  const temporary = `${filePath}.${process.pid}.${nonce}.tmp`;
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
      !TARGET_ROOT_ID_PATTERN.test(rootId) ||
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
  const receiptRelative = path.relative(approvedUserDataRoot, normalizedReceiptsRoot);
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
    if (typeof profileId !== "string" || !PROFILE_ID_PATTERN.test(profileId)) {
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

  function validateOwnedPaths(ownedPaths, profile) {
    const target = expectedTarget(profile);
    const approvedTargetRoot = targetRoot(profile);
    if (
      !Array.isArray(ownedPaths) ||
      ownedPaths.length === 0 ||
      new Set(ownedPaths).size !== ownedPaths.length ||
      !ownedPaths.includes(target)
    ) {
      return false;
    }
    return ownedPaths.every((ownedPath) => {
      if (typeof ownedPath !== "string" || !path.isAbsolute(ownedPath)) {
        return false;
      }
      const normalizedOwnedPath = path.resolve(ownedPath);
      const rootRelative = path.relative(approvedTargetRoot, normalizedOwnedPath);
      if (
        rootRelative === "" ||
        rootRelative === ".." ||
        rootRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(rootRelative)
      ) {
        return false;
      }
      if (normalizedOwnedPath === target) return true;
      const targetRelative = path.relative(normalizedOwnedPath, target);
      return (
        targetRelative !== "" &&
        targetRelative !== ".." &&
        !targetRelative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(targetRelative)
      );
    });
  }

  function normalizeTargetManifest(value) {
    if (!isPlainObject(value) || !isPlainObject(value.files) || !Array.isArray(value.directories)) {
      return null;
    }
    const files = {};
    try {
      const entries = Object.entries(value.files);
      if (entries.length === 0 || entries.length > MAX_MANIFEST_FILES) return null;
      for (const [relativePath, hash] of entries.sort(([left], [right]) => left.localeCompare(right))) {
        const canonical = canonicalRelativePath(relativePath, "targetManifest file");
        if (typeof hash !== "string" || !SHA256_PATTERN.test(hash)) return null;
        files[canonical] = hash;
      }
      const directories = value.directories.map((directory) =>
        canonicalRelativePath(directory, "targetManifest directory")
      );
      if (
        new Set(directories).size !== directories.length ||
        directories.some((directory, index) => index > 0 && directories[index - 1].localeCompare(directory) > 0)
      ) {
        return null;
      }
      return Object.freeze({ files: Object.freeze(files), directories: Object.freeze(directories) });
    } catch {
      return null;
    }
  }

  function validateReceipt(receipt, profileId, profile) {
    if (
      !isPlainObject(receipt) ||
      ![RECEIPT_SCHEMA_VERSION, LEGACY_RECEIPT_SCHEMA_VERSION].includes(receipt.schemaVersion) ||
      receipt.profileId !== profileId ||
      receipt.adapterId !== profile.adapterId ||
      receipt.extensionId !== profile.extensionId ||
      receipt.hostProductId !== profile.hostProductId ||
      typeof receipt.installedAt !== "string" ||
      !Number.isFinite(Date.parse(receipt.installedAt)) ||
      !validateOwnedPaths(receipt.ownedPaths, profile)
    ) {
      return null;
    }
    if (receipt.schemaVersion === LEGACY_RECEIPT_SCHEMA_VERSION) {
      return Object.freeze({ receipt, legacy: true });
    }
    let sourceManifest;
    try {
      sourceManifest = normalizeSourceManifest(receipt.sourceManifest);
    } catch {
      return null;
    }
    const targetManifest = normalizeTargetManifest(receipt.targetManifest);
    if (
      typeof receipt.versionRef !== "string" ||
      receipt.versionRef !== sourceManifest.versionRef ||
      !targetManifest ||
      !sameFiles(sourceManifest.files, targetManifest.files) ||
      typeof receipt.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(receipt.updatedAt))
    ) {
      return null;
    }
    return Object.freeze({
      receipt,
      legacy: false,
      sourceManifest,
      targetManifest
    });
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
      const rootStat = fsApi.lstatSync(normalizedReceiptsRoot);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
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
      const validated = validateReceipt(parsed, profileId, profile);
      return validated
        ? { state: "valid", ...validated }
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

  function inspectTarget(profile, receiptResult) {
    const approvedTargetRoot = targetRoot(profile);
    const target = expectedTarget(profile);
    try {
      if (fsApi.existsSync(approvedTargetRoot)) {
        assertAbsoluteAncestorsHaveNoLinks(approvedTargetRoot, fsApi);
        const rootStat = fsApi.lstatSync(approvedTargetRoot);
        if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
          return { state: "unsafe", managed: false, targetPath: target };
        }
        assertExistingAncestorsHaveNoLinks(
          approvedTargetRoot,
          path.dirname(target),
          fsApi
        );
      }
      const targetExists = fsApi.existsSync(target);
      if (!targetExists) {
        return {
          state: receiptResult.receipt ? "stale" : "not-installed",
          managed: false,
          targetPath: target
        };
      }
      const targetTree = scanDirectory(target, fsApi);
      if (!receiptResult.receipt) {
        return { state: "external", managed: false, targetPath: target };
      }
      if (receiptResult.legacy) {
        return {
          state: "outdated",
          managed: true,
          targetPath: target,
          versionRef: null,
          targetTree,
          legacyReceipt: true
        };
      }
      if (!sameTree(targetTree, receiptResult.targetManifest)) {
        return {
          state: "modified",
          managed: true,
          targetPath: target,
          versionRef: receiptResult.receipt.versionRef,
          targetTree
        };
      }
      const desired = normalizeSourceManifest(profile.sourceManifest);
      if (
        desired.versionRef !== receiptResult.sourceManifest.versionRef ||
        !sameFiles(desired.files, receiptResult.sourceManifest.files)
      ) {
        return {
          state: "outdated",
          managed: true,
          targetPath: target,
          versionRef: receiptResult.receipt.versionRef,
          targetTree
        };
      }
      return {
        state: "installed",
        managed: true,
        targetPath: target,
        versionRef: receiptResult.receipt.versionRef,
        targetTree
      };
    } catch (error) {
      if (
        [
          "EXTENSION_SYMLINK_REJECTED",
          "EXTENSION_FILE_TYPE_REJECTED",
          "EXTENSION_ROOT_UNSAFE",
          "EXTENSION_TARGET_INVALID",
          "EXTENSION_PATH_OUTSIDE_ROOT"
        ].includes(error.code)
      ) {
        return { state: "unsafe", managed: false, targetPath: target };
      }
      throw error;
    }
  }

  function getStatus(profileId) {
    const profile = resolveProfile(profileId);
    const target = expectedTarget(profile);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") {
      return { state: "invalid-receipt", managed: false, targetPath: target };
    }
    const status = inspectTarget(profile, receiptResult);
    const { targetTree: _targetTree, ...publicStatus } = status;
    return publicStatus;
  }

  function approvedSource(profile) {
    const source = resolveWithin(
      approvedResourcesRoot,
      profile.sourcePath,
      "sourcePath"
    );
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
    const sourceRelative = path.relative(canonicalResourcesRoot, canonicalSource);
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
    const tree = scanDirectory(source, fsApi, { excludeSourceMetadata: true });
    const declared = normalizeSourceManifest(profile.sourceManifest);
    if (!sameFiles(tree.files, declared.files)) {
      throw extensionError(
        "EXTENSION_SOURCE_MANIFEST_MISMATCH",
        "Bundled extension snapshot does not match its approved manifest"
      );
    }
    return Object.freeze({ source, tree, manifest: declared });
  }

  function buildReceipt(profileId, profile, sourceInfo, ownedPaths, previousReceipt = null) {
    const timestamp = now();
    const installedAt = previousReceipt?.installedAt || timestamp;
    return Object.freeze({
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      profileId,
      adapterId: profile.adapterId,
      extensionId: profile.extensionId,
      hostProductId: profile.hostProductId,
      versionRef: sourceInfo.manifest.versionRef,
      sourceManifest: {
        versionRef: sourceInfo.manifest.versionRef,
        files: { ...sourceInfo.manifest.files }
      },
      targetManifest: {
        files: { ...sourceInfo.tree.files },
        directories: [...sourceInfo.tree.directories]
      },
      installedAt,
      updatedAt: timestamp,
      ownedPaths: [...ownedPaths]
    });
  }

  function uniqueSibling(target, suffix) {
    return `${target}.aihub-${suffix}-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  }

  function stageSource(sourceInfo, target) {
    const staging = uniqueSibling(target, "staging");
    copySnapshot(sourceInfo.source, staging, fsApi, {
      excludeSourceMetadata: true
    });
    const stagedTree = scanDirectory(staging, fsApi);
    if (!sameTree(stagedTree, sourceInfo.tree)) {
      safeRemoveOwnedDirectory(staging, fsApi);
      throw extensionError(
        "EXTENSION_STAGE_MISMATCH",
        "Staged extension snapshot failed integrity verification"
      );
    }
    return staging;
  }

  function removeEmptyOwnedParents(receipt, target, fsApiOverride = fsApi) {
    const parents = receipt.ownedPaths
      .filter((ownedPath) => path.resolve(ownedPath) !== path.resolve(target))
      .sort((left, right) => right.length - left.length);
    for (const directory of parents) {
      if (!fsApiOverride.existsSync(directory)) continue;
      const stat = fsApiOverride.lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw extensionError(
          "EXTENSION_OWNED_PATH_UNSAFE",
          "Owned extension path changed to an unsafe file type"
        );
      }
      try {
        fsApiOverride.rmdirSync(directory);
      } catch (error) {
        if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
      }
    }
  }

  function installFresh(profileId, profile) {
    const approvedTargetRoot = targetRoot(profile);
    const target = expectedTarget(profile);
    const sourceInfo = approvedSource(profile);
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
    const createdParents = createdParentDirectories(approvedTargetRoot, target, fsApi);
    let staging = null;
    let published = false;
    try {
      fsApi.mkdirSync(path.dirname(target), { recursive: true });
      assertExistingAncestorsHaveNoLinks(
        approvedTargetRoot,
        path.dirname(target),
        fsApi
      );
      staging = stageSource(sourceInfo, target);
      if (fsApi.existsSync(target)) {
        throw extensionError(
          "EXTENSION_TARGET_EXISTS",
          "Extension target appeared during installation"
        );
      }
      fsApi.renameSync(staging, target);
      staging = null;
      published = true;
      const receipt = buildReceipt(
        profileId,
        profile,
        sourceInfo,
        [...createdParents, target]
      );
      ensureDirectoryWithoutLinks(normalizedReceiptsRoot, fsApi);
      writeJsonAtomic(receiptPath(profileId), receipt, fsApi);
      return { state: "installed", receipt: structuredClone(receipt) };
    } catch (error) {
      if (staging && fsApi.existsSync(staging)) {
        try {
          safeRemoveOwnedDirectory(staging, fsApi);
        } catch {}
      }
      if (published && fsApi.existsSync(target)) {
        try {
          const tree = scanDirectory(target, fsApi);
          if (sameTree(tree, sourceInfo.tree)) safeRemoveOwnedDirectory(target, fsApi);
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

  function update(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") return installFresh(profileId, profile);
    if (receiptResult.state === "invalid") {
      throw extensionError(
        "EXTENSION_RECEIPT_INVALID",
        "Extension receipt is invalid; no files were changed"
      );
    }
    const status = inspectTarget(profile, receiptResult);
    if (status.state === "installed") {
      return { state: "installed", receipt: structuredClone(receiptResult.receipt) };
    }
    if (status.state === "modified") {
      throw extensionError(
        "EXTENSION_TARGET_MODIFIED",
        "Extension files were modified; update refused to preserve user data"
      );
    }
    if (status.state === "stale") return repair(profileId);
    if (status.state !== "outdated") {
      throw extensionError(
        "EXTENSION_UPDATE_UNSAFE",
        "Extension cannot be safely updated in its current state"
      );
    }

    const sourceInfo = approvedSource(profile);
    const target = expectedTarget(profile);
    if (receiptResult.legacy) {
      const currentTree = scanDirectory(target, fsApi);
      if (!sameTree(currentTree, sourceInfo.tree)) {
        throw extensionError(
          "EXTENSION_TARGET_MODIFIED",
          "Legacy extension contents cannot be verified; update refused"
        );
      }
      const receipt = buildReceipt(
        profileId,
        profile,
        sourceInfo,
        receiptResult.receipt.ownedPaths,
        receiptResult.receipt
      );
      writeJsonAtomic(receiptPath(profileId), receipt, fsApi);
      return { state: "installed", receipt: structuredClone(receipt) };
    }

    let staging = null;
    let backup = null;
    try {
      staging = stageSource(sourceInfo, target);
      const currentTree = scanDirectory(target, fsApi);
      if (!sameTree(currentTree, receiptResult.targetManifest)) {
        throw extensionError(
          "EXTENSION_TARGET_MODIFIED",
          "Extension changed during update; no files were replaced"
        );
      }
      backup = uniqueSibling(target, "backup");
      fsApi.renameSync(target, backup);
      try {
        fsApi.renameSync(staging, target);
        staging = null;
      } catch (error) {
        fsApi.renameSync(backup, target);
        backup = null;
        throw error;
      }
      const receipt = buildReceipt(
        profileId,
        profile,
        sourceInfo,
        receiptResult.receipt.ownedPaths,
        receiptResult.receipt
      );
      try {
        writeJsonAtomic(receiptPath(profileId), receipt, fsApi);
      } catch (error) {
        safeRemoveOwnedDirectory(target, fsApi);
        fsApi.renameSync(backup, target);
        backup = null;
        throw error;
      }
      safeRemoveOwnedDirectory(backup, fsApi);
      backup = null;
      return { state: "installed", receipt: structuredClone(receipt) };
    } finally {
      if (staging && fsApi.existsSync(staging)) {
        try {
          safeRemoveOwnedDirectory(staging, fsApi);
        } catch {}
      }
      if (backup && fsApi.existsSync(backup) && !fsApi.existsSync(target)) {
        try {
          fsApi.renameSync(backup, target);
        } catch {}
      }
    }
  }

  function repair(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") return installFresh(profileId, profile);
    if (receiptResult.state === "invalid") {
      throw extensionError(
        "EXTENSION_RECEIPT_INVALID",
        "Extension receipt is invalid; no files were changed"
      );
    }
    const status = inspectTarget(profile, receiptResult);
    if (status.state === "installed") {
      return { state: "installed", receipt: structuredClone(receiptResult.receipt) };
    }
    if (status.state === "outdated") return update(profileId);
    if (status.state === "modified") {
      throw extensionError(
        "EXTENSION_TARGET_MODIFIED",
        "Extension files were modified; repair refused to preserve user data"
      );
    }
    if (status.state !== "stale") {
      throw extensionError(
        "EXTENSION_REPAIR_UNSAFE",
        "Extension cannot be safely repaired in its current state"
      );
    }

    const approvedTargetRoot = targetRoot(profile);
    const target = expectedTarget(profile);
    const sourceInfo = approvedSource(profile);
    ensureDirectoryWithoutLinks(approvedTargetRoot, fsApi);
    assertExistingAncestorsHaveNoLinks(
      approvedTargetRoot,
      path.dirname(target),
      fsApi
    );
    const createdParents = createdParentDirectories(approvedTargetRoot, target, fsApi);
    let staging = null;
    let published = false;
    try {
      fsApi.mkdirSync(path.dirname(target), { recursive: true });
      staging = stageSource(sourceInfo, target);
      if (fsApi.existsSync(target)) {
        throw extensionError(
          "EXTENSION_TARGET_EXISTS",
          "Extension target appeared during repair"
        );
      }
      fsApi.renameSync(staging, target);
      staging = null;
      published = true;
      const ownedPaths = [
        ...new Set([...receiptResult.receipt.ownedPaths, ...createdParents, target])
      ];
      const receipt = buildReceipt(
        profileId,
        profile,
        sourceInfo,
        ownedPaths,
        receiptResult.receipt
      );
      writeJsonAtomic(receiptPath(profileId), receipt, fsApi);
      return { state: "installed", receipt: structuredClone(receipt) };
    } catch (error) {
      if (staging && fsApi.existsSync(staging)) {
        try {
          safeRemoveOwnedDirectory(staging, fsApi);
        } catch {}
      }
      if (published && fsApi.existsSync(target)) {
        try {
          const tree = scanDirectory(target, fsApi);
          if (sameTree(tree, sourceInfo.tree)) safeRemoveOwnedDirectory(target, fsApi);
        } catch {}
      }
      throw error;
    }
  }

  function install(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") return installFresh(profileId, profile);
    if (receiptResult.state === "invalid") {
      throw extensionError(
        "EXTENSION_RECEIPT_INVALID",
        "Extension receipt is invalid; no files were changed"
      );
    }
    const status = inspectTarget(profile, receiptResult);
    if (status.state === "installed") {
      return { state: "installed", receipt: structuredClone(receiptResult.receipt) };
    }
    if (status.state === "outdated") return update(profileId);
    if (status.state === "stale") return repair(profileId);
    if (status.state === "modified") {
      throw extensionError(
        "EXTENSION_TARGET_MODIFIED",
        "Extension files were modified; install refused to preserve user data"
      );
    }
    throw extensionError(
      "EXTENSION_INSTALL_UNSAFE",
      "Extension cannot be safely installed in its current state"
    );
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
    const status = inspectTarget(profile, result);
    if (status.state === "unsafe") {
      assertAbsoluteAncestorsHaveNoLinks(targetRoot(profile), fsApi);
      assertExistingAncestorsHaveNoLinks(
        targetRoot(profile),
        path.dirname(expectedTarget(profile)),
        fsApi
      );
      throw extensionError(
        "EXTENSION_UNINSTALL_UNSAFE",
        "Extension target is unsafe; no files were removed"
      );
    }
    if (status.state === "modified") {
      throw extensionError(
        "EXTENSION_TARGET_MODIFIED",
        "Extension files were modified; uninstall refused to preserve user data"
      );
    }
    const target = expectedTarget(profile);
    if (fsApi.existsSync(target)) {
      if (result.legacy) {
        const sourceInfo = approvedSource(profile);
        const currentTree = scanDirectory(target, fsApi);
        if (!sameTree(currentTree, sourceInfo.tree)) {
          throw extensionError(
            "EXTENSION_TARGET_MODIFIED",
            "Legacy extension contents cannot be verified; no files were removed"
          );
        }
      } else {
        const currentTree = scanDirectory(target, fsApi);
        if (!sameTree(currentTree, result.targetManifest)) {
          throw extensionError(
            "EXTENSION_TARGET_MODIFIED",
            "Extension changed during uninstall; no files were removed"
          );
        }
      }
      safeRemoveOwnedDirectory(target, fsApi);
    }
    removeEmptyOwnedParents(result.receipt, target);
    fsApi.unlinkSync(receiptPath(profileId));
    return { state: "uninstalled" };
  }

  function execute(profileId, operation) {
    switch (operation) {
      case "install":
        return install(profileId);
      case "update":
        return update(profileId);
      case "repair":
        return repair(profileId);
      case "uninstall":
        return uninstall(profileId);
      default:
        throw extensionError(
          "EXTENSION_OPERATION_NOT_APPROVED",
          "Extension operation is not locally approved"
        );
    }
  }

  return Object.freeze({
    inspect: getStatus,
    execute,
    getReceipt,
    getStatus,
    install,
    update,
    repair,
    uninstall
  });
}

module.exports = {
  RECEIPT_SCHEMA_VERSION,
  assertDirectorySnapshotProfile,
  createExtensionRuntime,
  relativeSegments,
  scanDirectory
};
