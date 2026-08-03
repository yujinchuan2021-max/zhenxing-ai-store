"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RECEIPT_SCHEMA_VERSION = 2;
const MARKER_SCHEMA_VERSION = 1;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const QUALIFIED_PLUGIN_ID = /^[a-z0-9][a-z0-9._-]{0,127}@[a-z0-9][a-z0-9._-]{0,127}$/i;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const INSTANCE_FINGERPRINT = /^[a-f0-9]{64}$/;
const MAX_RECEIPT_BYTES = 64 * 1024;
const MAX_REGISTRY_BYTES = 2 * 1024 * 1024;
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;
const OWNERSHIP_MARKER = ".zhenxing-ai-owner.json";

function runtimeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertProfile(profile) {
  if (
    !isRecord(profile) ||
    profile.adapterId !== "claude-plugin-cli" ||
    !SAFE_ID.test(profile.extensionId || "") ||
    !SAFE_ID.test(profile.hostProductId || "") ||
    !QUALIFIED_PLUGIN_ID.test(profile.pluginId || "") ||
    profile.scope !== "user" ||
    typeof profile.versionRef !== "string" ||
    !profile.versionRef ||
    profile.versionRef.length > 256
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Claude plugin profile");
  }
  if (profile.marketplace !== undefined) {
    if (
      !isRecord(profile.marketplace) ||
      typeof profile.marketplace.source !== "string" ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(profile.marketplace.source)
    ) {
      throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Claude plugin marketplace");
    }
  }
  return profile;
}

function ensureSafeDirectory(directory, fsApi = fs) {
  if (!path.isAbsolute(directory) || path.parse(directory).root === path.resolve(directory)) {
    throw runtimeError("EXTENSION_RECEIPT_UNSAFE", "Unsafe plugin receipt directory");
  }
  const root = path.parse(directory).root;
  let current = root;
  for (const segment of path.relative(root, directory).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (!fsApi.existsSync(current)) break;
    const stat = fsApi.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw runtimeError("EXTENSION_RECEIPT_UNSAFE", "Unsafe plugin receipt directory");
    }
  }
  fsApi.mkdirSync(directory, { recursive: true });
}

function readSmallFile(filePath, fsApi = fs) {
  if (!fsApi.existsSync(filePath)) return null;
  const stat = fsApi.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_RECEIPT_BYTES) {
    throw runtimeError("EXTENSION_RECEIPT_INVALID", "Plugin receipt is invalid");
  }
  return fsApi.readFileSync(filePath, "utf8");
}

function readBoundedFile(filePath, maxBytes, fsApi = fs) {
  if (!fsApi.existsSync(filePath)) return null;
  const stat = fsApi.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > maxBytes) {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Plugin host state is invalid");
  }
  return fsApi.readFileSync(filePath, "utf8");
}

function writeAtomic(filePath, value, fsApi = fs) {
  ensureSafeDirectory(path.dirname(filePath), fsApi);
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fsApi.writeFileSync(temporary, value, { encoding: "utf8", flag: "wx" });
  try {
    fsApi.renameSync(temporary, filePath);
  } catch (error) {
    try { fsApi.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function jsonRows(stdout, property) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > MAX_COMMAND_OUTPUT) {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Plugin host response is invalid");
  }
  let parsed;
  try {
    parsed = JSON.parse(stdout || "[]");
  } catch {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Plugin host response is invalid");
  }
  const rows = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed[property] : null;
  if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Plugin host response is invalid");
  }
  return rows;
}

function pluginCandidates(row) {
  const values = [row.id, row.pluginId, row.name].filter((value) => typeof value === "string");
  const marketplace = [row.marketplace, row.marketplaceName, row.source]
    .find((value) => typeof value === "string");
  if (typeof row.name === "string" && marketplace) values.push(`${row.name}@${marketplace}`);
  return values;
}

function findPlugin(rows, pluginId) {
  return rows.find((row) => pluginCandidates(row).includes(pluginId)) || null;
}

function marketplaceInstalled(rows, source) {
  return rows.some((row) => [row.source, row.repository, row.repo, row.url, row.name].includes(source));
}

function pluginDataDirectoryName(pluginId) {
  return pluginId.replace(/[^A-Za-z0-9_-]/g, "-");
}

function createClaudePluginRuntime({
  receiptsRoot,
  ownershipRoot,
  registryPath,
  profileLookup,
  resolveHostExecutable,
  runHostCommand,
  fsApi = fs,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes
}) {
  if (
    typeof receiptsRoot !== "string" ||
    !path.isAbsolute(receiptsRoot) ||
    typeof ownershipRoot !== "string" ||
    !path.isAbsolute(ownershipRoot) ||
    typeof registryPath !== "string" ||
    !path.isAbsolute(registryPath) ||
    typeof profileLookup !== "function" ||
    typeof resolveHostExecutable !== "function" ||
    typeof runHostCommand !== "function" ||
    typeof randomBytes !== "function"
  ) {
    throw new TypeError("Claude plugin runtime options are invalid");
  }

  function resolveProfile(profileId) {
    if (typeof profileId !== "string" || !PROFILE_ID.test(profileId)) {
      throw runtimeError("EXTENSION_PROFILE_NOT_APPROVED", "Profile is not approved");
    }
    const profile = profileLookup(profileId);
    if (!profile) throw runtimeError("EXTENSION_PROFILE_NOT_APPROVED", "Profile is not approved");
    return assertProfile(profile);
  }

  function receiptPath(profileId) {
    return path.join(receiptsRoot, `${profileId}.json`);
  }

  function markerPath(profile) {
    return path.join(ownershipRoot, pluginDataDirectoryName(profile.pluginId), OWNERSHIP_MARKER);
  }

  function readReceipt(profileId, profile) {
    let text;
    try {
      text = readSmallFile(receiptPath(profileId), fsApi);
    } catch {
      return { state: "invalid", receipt: null };
    }
    if (text === null) return { state: "missing", receipt: null };
    try {
      const receipt = JSON.parse(text);
      if (
        !isRecord(receipt) ||
        receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
        receipt.profileId !== profileId ||
        receipt.adapterId !== profile.adapterId ||
        receipt.extensionId !== profile.extensionId ||
        receipt.hostProductId !== profile.hostProductId ||
        receipt.pluginId !== profile.pluginId ||
        receipt.scope !== "user" ||
        typeof receipt.managementId !== "string" ||
        !MANAGEMENT_ID.test(receipt.managementId) ||
        typeof receipt.instanceFingerprint !== "string" ||
        !INSTANCE_FINGERPRINT.test(receipt.instanceFingerprint) ||
        typeof receipt.versionRef !== "string" ||
        typeof receipt.enabled !== "boolean" ||
        typeof receipt.installedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.installedAt)) ||
        typeof receipt.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.updatedAt))
      ) {
        return { state: "invalid", receipt: null };
      }
      return { state: "valid", receipt };
    } catch {
      return { state: "invalid", receipt: null };
    }
  }

  function readMarker(profileId, profile) {
    let text;
    try {
      text = readSmallFile(markerPath(profile), fsApi);
    } catch {
      return { state: "invalid", marker: null };
    }
    if (text === null) return { state: "missing", marker: null };
    try {
      const marker = JSON.parse(text);
      if (
        !isRecord(marker) ||
        marker.schemaVersion !== MARKER_SCHEMA_VERSION ||
        marker.profileId !== profileId ||
        marker.pluginId !== profile.pluginId ||
        marker.scope !== "user" ||
        typeof marker.managementId !== "string" ||
        !MANAGEMENT_ID.test(marker.managementId)
      ) {
        return { state: "invalid", marker: null };
      }
      return { state: "valid", marker };
    } catch {
      return { state: "invalid", marker: null };
    }
  }

  function markerMatches(profileId, profile, receipt) {
    const result = readMarker(profileId, profile);
    return result.state === "valid" && result.marker.managementId === receipt.managementId;
  }

  function readPluginInstance(profile) {
    let text;
    try {
      text = readBoundedFile(registryPath, MAX_REGISTRY_BYTES, fsApi);
    } catch {
      return { state: "invalid", fingerprint: "" };
    }
    if (text === null) return { state: "missing", fingerprint: "" };
    try {
      const registry = JSON.parse(text);
      const rows = registry?.plugins?.[profile.pluginId];
      if (!Array.isArray(rows)) return { state: "missing", fingerprint: "" };
      const matches = rows.filter((row) => isRecord(row) && row.scope === "user");
      if (matches.length !== 1) return { state: "invalid", fingerprint: "" };
      const row = matches[0];
      if (
        typeof row.installPath !== "string" ||
        !row.installPath ||
        row.installPath.length > 2048 ||
        typeof row.version !== "string" ||
        !row.version ||
        row.version.length > 256 ||
        typeof row.installedAt !== "string" ||
        !Number.isFinite(Date.parse(row.installedAt)) ||
        typeof row.lastUpdated !== "string" ||
        !Number.isFinite(Date.parse(row.lastUpdated))
      ) {
        return { state: "invalid", fingerprint: "" };
      }
      const fingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify([
          profile.pluginId,
          row.scope,
          row.installPath,
          row.version,
          row.installedAt,
          row.lastUpdated
        ]))
        .digest("hex");
      return { state: "valid", fingerprint };
    } catch {
      return { state: "invalid", fingerprint: "" };
    }
  }

  function instanceMatches(profile, receipt) {
    const instance = readPluginInstance(profile);
    return (
      instance.state === "valid" &&
      instance.fingerprint === receipt.instanceFingerprint
    );
  }

  function writeMarker(profileId, profile, managementId) {
    const marker = {
      schemaVersion: MARKER_SCHEMA_VERSION,
      profileId,
      pluginId: profile.pluginId,
      scope: "user",
      managementId
    };
    writeAtomic(markerPath(profile), `${JSON.stringify(marker, null, 2)}\n`, fsApi);
  }

  function removeMarkerIfOwned(profileId, profile, receipt) {
    if (!markerMatches(profileId, profile, receipt)) return;
    fsApi.unlinkSync(markerPath(profile));
  }

  function persistOwnership(profileId, profile, enabled, previous = null) {
    let existingMarker = null;
    try {
      existingMarker = readSmallFile(markerPath(profile), fsApi);
    } catch {}
    const timestamp = now();
    const generatedId = Buffer.from(randomBytes(24)).toString("hex");
    if (!previous?.managementId && !MANAGEMENT_ID.test(generatedId)) {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Plugin ownership could not be created");
    }
    const instance = readPluginInstance(profile);
    if (instance.state !== "valid") {
      throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin installation was not confirmed");
    }
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      profileId,
      adapterId: profile.adapterId,
      extensionId: profile.extensionId,
      hostProductId: profile.hostProductId,
      pluginId: profile.pluginId,
      scope: "user",
      managementId: previous?.managementId || generatedId,
      instanceFingerprint: instance.fingerprint,
      versionRef: profile.versionRef,
      enabled,
      installedAt: previous?.installedAt || timestamp,
      updatedAt: timestamp
    };
    try {
      writeMarker(profileId, profile, receipt.managementId);
      writeAtomic(receiptPath(profileId), `${JSON.stringify(receipt, null, 2)}\n`, fsApi);
    } catch (error) {
      try {
        if (existingMarker === null) {
          if (fsApi.existsSync(markerPath(profile))) fsApi.unlinkSync(markerPath(profile));
        } else {
          writeAtomic(markerPath(profile), existingMarker, fsApi);
        }
      } catch {}
      throw error;
    }
    return receipt;
  }

  function removeReceipt(profileId) {
    const target = receiptPath(profileId);
    if (fsApi.existsSync(target)) fsApi.unlinkSync(target);
  }

  async function hostExecutable(profile) {
    try {
      const executable = await resolveHostExecutable(profile.hostProductId);
      return typeof executable === "string" && executable ? executable : null;
    } catch {
      return null;
    }
  }

  async function command(executable, args) {
    let result;
    try {
      result = await runHostCommand({ executable, args: [...args] });
    } catch {
      throw runtimeError("EXTENSION_HOST_COMMAND_FAILED", "Plugin operation failed");
    }
    if (!isRecord(result) || result.ok !== true || typeof result.stdout !== "string") {
      throw runtimeError("EXTENSION_HOST_COMMAND_FAILED", "Plugin operation failed");
    }
    return result.stdout;
  }

  async function listPlugins(executable) {
    return jsonRows(await command(executable, ["plugin", "list", "--json"]), "plugins");
  }

  async function inspect(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") return { state: "invalid-receipt", managed: false };
    const executable = await hostExecutable(profile);
    if (!executable) {
      return { state: "host-missing", managed: receiptResult.state === "valid" };
    }
    let installed;
    try {
      installed = findPlugin(await listPlugins(executable), profile.pluginId);
    } catch (error) {
      if (error.code) throw error;
      throw runtimeError("EXTENSION_HOST_COMMAND_FAILED", "Plugin inspection failed");
    }
    if (receiptResult.state === "missing") {
      return { state: installed ? "external" : "not-installed", managed: false };
    }
    if (!installed) {
      removeMarkerIfOwned(profileId, profile, receiptResult.receipt);
      return { state: "stale", managed: true };
    }
    if (
      !markerMatches(profileId, profile, receiptResult.receipt) ||
      !instanceMatches(profile, receiptResult.receipt)
    ) {
      return { state: "modified", managed: false };
    }
    const enabled = installed.enabled !== false;
    const actualVersion = [installed.version, installed.versionRef]
      .find((value) => typeof value === "string" && value);
    if (
      receiptResult.receipt.versionRef !== profile.versionRef ||
      (actualVersion && actualVersion !== profile.versionRef)
    ) {
      return { state: "outdated", managed: true, enabled };
    }
    return { state: enabled ? "installed" : "disabled", managed: true, enabled };
  }

  async function ensureMarketplace(executable, profile) {
    if (!profile.marketplace) return;
    const rows = jsonRows(
      await command(executable, ["plugin", "marketplace", "list", "--json"]),
      "marketplaces"
    );
    if (!marketplaceInstalled(rows, profile.marketplace.source)) {
      await command(executable, ["plugin", "marketplace", "add", profile.marketplace.source]);
    }
  }

  async function install(profileId) {
    const profile = resolveProfile(profileId);
    const before = await inspect(profileId);
    if (["installed", "disabled"].includes(before.state)) return before;
    if (before.state === "outdated") return update(profileId);
    if (before.state === "stale") return repair(profileId);
    if (before.state === "host-missing") {
      throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    }
    if (before.state !== "not-installed") {
      throw runtimeError("EXTENSION_TARGET_EXISTS", "Plugin is already owned externally");
    }
    const executable = await hostExecutable(profile);
    if (!executable) throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    await ensureMarketplace(executable, profile);
    await command(executable, ["plugin", "install", profile.pluginId, "--scope", "user"]);
    const installed = findPlugin(await listPlugins(executable), profile.pluginId);
    if (!installed) throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin installation was not confirmed");
    persistOwnership(profileId, profile, installed.enabled !== false);
    return inspect(profileId);
  }

  async function requireManaged(profileId, allowedStates) {
    const profile = resolveProfile(profileId);
    const status = await inspect(profileId);
    if (status.state === "host-missing") {
      throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    }
    if (!allowedStates.includes(status.state)) {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Plugin is not managed by ZhenXing AI");
    }
    const executable = await hostExecutable(profile);
    if (!executable) throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    const receipt = readReceipt(profileId, profile).receipt;
    if (
      !receipt ||
      !markerMatches(profileId, profile, receipt) ||
      !instanceMatches(profile, receipt)
    ) {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Plugin is not managed by ZhenXing AI");
    }
    return { profile, status, executable, receipt };
  }

  async function update(profileId) {
    const { profile, executable, receipt } = await requireManaged(
      profileId,
      ["installed", "disabled", "outdated"]
    );
    await command(executable, ["plugin", "update", profile.pluginId, "--scope", "user"]);
    const installed = findPlugin(await listPlugins(executable), profile.pluginId);
    if (!installed) throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin update was not confirmed");
    persistOwnership(profileId, profile, installed.enabled !== false, receipt);
    return inspect(profileId);
  }

  async function repair(profileId) {
    const profile = resolveProfile(profileId);
    const status = await inspect(profileId);
    if (["installed", "disabled", "outdated"].includes(status.state)) return update(profileId);
    if (status.state !== "stale") {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Plugin is not managed by ZhenXing AI");
    }
    const executable = await hostExecutable(profile);
    if (!executable) throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    await ensureMarketplace(executable, profile);
    await command(executable, ["plugin", "install", profile.pluginId, "--scope", "user"]);
    const installed = findPlugin(await listPlugins(executable), profile.pluginId);
    if (!installed) throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin repair was not confirmed");
    persistOwnership(
      profileId,
      profile,
      installed.enabled !== false,
      readReceipt(profileId, profile).receipt
    );
    return inspect(profileId);
  }

  async function setEnabled(profileId, enabled) {
    const { profile, executable, receipt } = await requireManaged(
      profileId,
      ["installed", "disabled", "outdated"]
    );
    await command(executable, ["plugin", enabled ? "enable" : "disable", profile.pluginId, "--scope", "user"]);
    const installed = findPlugin(await listPlugins(executable), profile.pluginId);
    if (!installed || (installed.enabled !== false) !== enabled) {
      throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin state change was not confirmed");
    }
    persistOwnership(profileId, profile, enabled, receipt);
    return inspect(profileId);
  }

  async function uninstall(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") {
      const status = await inspect(profileId);
      if (status.state === "not-installed") return status;
      throw runtimeError("EXTENSION_NOT_MANAGED", "Plugin is not managed by ZhenXing AI");
    }
    if (receiptResult.state !== "valid") {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Plugin receipt is invalid");
    }
    const executable = await hostExecutable(profile);
    if (!executable) throw runtimeError("EXTENSION_HOST_MISSING", "Plugin host is not installed");
    const installed = findPlugin(await listPlugins(executable), profile.pluginId);
    if (installed) {
      if (
        !markerMatches(profileId, profile, receiptResult.receipt) ||
        !instanceMatches(profile, receiptResult.receipt)
      ) {
        throw runtimeError("EXTENSION_NOT_MANAGED", "Plugin is not managed by ZhenXing AI");
      }
      await command(executable, [
        "plugin", "uninstall", profile.pluginId,
        "--scope", "user", "--keep-data", "--yes"
      ]);
      if (findPlugin(await listPlugins(executable), profile.pluginId)) {
        throw runtimeError("EXTENSION_POSTCONDITION_FAILED", "Plugin removal was not confirmed");
      }
    }
    removeMarkerIfOwned(profileId, profile, receiptResult.receipt);
    removeReceipt(profileId);
    return { state: "not-installed", managed: false };
  }

  async function execute(profileId, action) {
    switch (action) {
      case "install": return install(profileId);
      case "update": return update(profileId);
      case "repair": return repair(profileId);
      case "enable": return setEnabled(profileId, true);
      case "disable": return setEnabled(profileId, false);
      case "uninstall": return uninstall(profileId);
      default: throw runtimeError("EXTENSION_ACTION_NOT_APPROVED", "Action is not approved");
    }
  }

  return Object.freeze({ inspect, execute, install, update, repair, uninstall });
}

module.exports = {
  createClaudePluginRuntime,
  findPlugin,
  jsonRows
};
