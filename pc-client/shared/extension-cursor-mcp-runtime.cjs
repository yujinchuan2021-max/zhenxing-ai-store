"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RECEIPT_SCHEMA_VERSION = 1;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 64 * 1024;

function runtimeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedEntry(value) {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "url")) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Cursor MCP entry");
  }
  let endpoint;
  try {
    endpoint = new URL(value.url);
  } catch {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Cursor MCP URL");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Unsafe Cursor MCP URL");
  }
  return Object.freeze({ url: endpoint.href });
}

function assertProfile(profile) {
  if (
    !isRecord(profile) ||
    ["command", "args", "env", "headers"].some((field) =>
      Object.hasOwn(profile, field)
    ) ||
    profile.adapterId !== "cursor-mcp-json" ||
    typeof profile.extensionId !== "string" ||
    !profile.extensionId ||
    profile.hostProductId !== "cursor-desktop" ||
    profile.scope !== "user" ||
    !SAFE_ID.test(profile.serverId || "") ||
    typeof profile.versionRef !== "string" ||
    !profile.versionRef ||
    profile.versionRef.length > 256
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Cursor MCP profile");
  }
  normalizedEntry(profile.entry);
  return profile;
}

function readSmallFile(filePath, maximumBytes, errorCode, fsApi = fs) {
  if (!fsApi.existsSync(filePath)) return null;
  const stat = fsApi.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > maximumBytes) {
    throw runtimeError(errorCode, "Unsafe extension state file");
  }
  return fsApi.readFileSync(filePath, "utf8");
}

function ensureSafeDirectory(directory, fsApi = fs) {
  if (!path.isAbsolute(directory) || path.parse(directory).root === path.resolve(directory)) {
    throw runtimeError("EXTENSION_ROOT_UNSAFE", "Unsafe extension root");
  }
  const root = path.parse(directory).root;
  let current = root;
  for (const segment of path.relative(root, directory).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (!fsApi.existsSync(current)) break;
    const stat = fsApi.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw runtimeError("EXTENSION_ROOT_UNSAFE", "Unsafe extension root");
    }
  }
  fsApi.mkdirSync(directory, { recursive: true });
}

function writeAtomic(filePath, text, expectedText, maximumBytes, fsApi = fs) {
  const current = readSmallFile(
    filePath,
    maximumBytes,
    "EXTENSION_CONFIG_UNSAFE",
    fsApi
  );
  if ((current || "") !== (expectedText || "")) {
    throw runtimeError(
      "EXTENSION_CONFIG_CHANGED",
      "Host config changed during operation"
    );
  }
  ensureSafeDirectory(path.dirname(filePath), fsApi);
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fsApi.writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" });
  try {
    fsApi.renameSync(temporary, filePath);
  } catch (error) {
    try { fsApi.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function parseConfig(text) {
  if (text === null || text === "") {
    return { root: {}, servers: {} };
  }
  let root;
  try {
    root = JSON.parse(text);
  } catch {
    throw runtimeError("EXTENSION_CONFIG_UNSAFE", "Cursor MCP config is invalid");
  }
  if (!isRecord(root)) {
    throw runtimeError("EXTENSION_CONFIG_UNSAFE", "Cursor MCP config is invalid");
  }
  if (root.mcpServers !== undefined && !isRecord(root.mcpServers)) {
    throw runtimeError("EXTENSION_CONFIG_UNSAFE", "Cursor MCP servers are invalid");
  }
  return { root, servers: root.mcpServers || {} };
}

function serializeConfig(root) {
  return `${JSON.stringify(root, null, 2)}\n`;
}

function sameEntry(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createCursorMcpRuntime({
  configPath,
  receiptsRoot,
  profileLookup,
  fsApi = fs,
  now = () => new Date().toISOString()
}) {
  if (
    typeof configPath !== "string" ||
    !path.isAbsolute(configPath) ||
    typeof receiptsRoot !== "string" ||
    !path.isAbsolute(receiptsRoot) ||
    typeof profileLookup !== "function"
  ) {
    throw new TypeError("Cursor MCP runtime options are invalid");
  }

  function resolveProfile(profileId) {
    if (typeof profileId !== "string" || !PROFILE_ID.test(profileId)) {
      throw runtimeError("EXTENSION_PROFILE_NOT_APPROVED", "Profile is not approved");
    }
    const profile = profileLookup(profileId);
    if (!profile) {
      throw runtimeError("EXTENSION_PROFILE_NOT_APPROVED", "Profile is not approved");
    }
    return assertProfile(profile);
  }

  function receiptPath(profileId) {
    return path.join(receiptsRoot, `${profileId}.json`);
  }

  function readReceipt(profileId, profile) {
    let text;
    try {
      text = readSmallFile(
        receiptPath(profileId),
        MAX_RECEIPT_BYTES,
        "EXTENSION_RECEIPT_INVALID",
        fsApi
      );
    } catch {
      return { state: "invalid", receipt: null, text: null };
    }
    if (text === null) return { state: "missing", receipt: null, text: null };
    try {
      const receipt = JSON.parse(text);
      const entry = normalizedEntry(receipt.entry);
      if (
        !isRecord(receipt) ||
        receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
        receipt.profileId !== profileId ||
        receipt.adapterId !== profile.adapterId ||
        receipt.extensionId !== profile.extensionId ||
        receipt.hostProductId !== profile.hostProductId ||
        receipt.scope !== "user" ||
        receipt.serverId !== profile.serverId ||
        typeof receipt.versionRef !== "string" ||
        !receipt.versionRef ||
        !SHA256.test(receipt.entrySha256 || "") ||
        receipt.entrySha256 !== digest(JSON.stringify(entry)) ||
        typeof receipt.installedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.installedAt)) ||
        typeof receipt.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.updatedAt))
      ) {
        return { state: "invalid", receipt: null, text };
      }
      return { state: "valid", receipt: { ...receipt, entry }, text };
    } catch {
      return { state: "invalid", receipt: null, text };
    }
  }

  function writeReceipt(profileId, profile, previous = null) {
    const prior = readReceipt(profileId, profile);
    if (prior.state === "invalid") {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Cursor MCP receipt is invalid");
    }
    const entry = normalizedEntry(profile.entry);
    const timestamp = now();
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      profileId,
      adapterId: profile.adapterId,
      extensionId: profile.extensionId,
      hostProductId: profile.hostProductId,
      scope: "user",
      serverId: profile.serverId,
      versionRef: profile.versionRef,
      entry,
      entrySha256: digest(JSON.stringify(entry)),
      installedAt: previous?.installedAt || timestamp,
      updatedAt: timestamp
    };
    writeAtomic(
      receiptPath(profileId),
      `${JSON.stringify(receipt, null, 2)}\n`,
      prior.text,
      MAX_RECEIPT_BYTES,
      fsApi
    );
    return receipt;
  }

  function readConfig() {
    const text = readSmallFile(
      configPath,
      MAX_CONFIG_BYTES,
      "EXTENSION_CONFIG_UNSAFE",
      fsApi
    );
    return { text, ...parseConfig(text) };
  }

  function inspect(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") {
      return { state: "invalid-receipt", managed: false };
    }
    let config;
    try {
      config = readConfig();
    } catch {
      return { state: "unsafe", managed: false };
    }
    const existing = Object.hasOwn(config.servers, profile.serverId)
      ? config.servers[profile.serverId]
      : undefined;
    if (receiptResult.state === "missing") {
      return {
        state: existing === undefined ? "not-installed" : "external",
        managed: false
      };
    }
    if (existing === undefined) return { state: "stale", managed: true };
    if (!sameEntry(existing, receiptResult.receipt.entry)) {
      return { state: "modified", managed: false };
    }
    const currentEntry = normalizedEntry(profile.entry);
    if (
      receiptResult.receipt.versionRef !== profile.versionRef ||
      !sameEntry(receiptResult.receipt.entry, currentEntry)
    ) {
      return { state: "outdated", managed: true };
    }
    return { state: "installed", managed: true };
  }

  function replaceConfig(config, profile, entry) {
    const root = { ...config.root };
    const servers = { ...config.servers };
    if (entry === undefined) delete servers[profile.serverId];
    else servers[profile.serverId] = entry;
    root.mcpServers = servers;
    const after = serializeConfig(root);
    writeAtomic(
      configPath,
      after,
      config.text,
      MAX_CONFIG_BYTES,
      fsApi
    );
    return after;
  }

  function restoreConfig(before, after) {
    if (before === null) {
      const current = readSmallFile(
        configPath,
        MAX_CONFIG_BYTES,
        "EXTENSION_CONFIG_UNSAFE",
        fsApi
      );
      if (current !== after) {
        throw runtimeError(
          "EXTENSION_CONFIG_CHANGED",
          "Host config changed during rollback"
        );
      }
      fsApi.unlinkSync(configPath);
      return;
    }
    writeAtomic(configPath, before, after, MAX_CONFIG_BYTES, fsApi);
  }

  function install(profileId) {
    const profile = resolveProfile(profileId);
    const status = inspect(profileId);
    if (status.state === "installed") return status;
    if (status.state === "outdated") return update(profileId);
    if (status.state === "stale") return repair(profileId);
    if (status.state !== "not-installed") {
      throw runtimeError(
        "EXTENSION_TARGET_EXISTS",
        "Cursor MCP target is already owned externally"
      );
    }
    const config = readConfig();
    const before = config.text;
    const after = replaceConfig(config, profile, normalizedEntry(profile.entry));
    try {
      writeReceipt(profileId, profile);
    } catch (error) {
      restoreConfig(before, after);
      throw error;
    }
    return inspect(profileId);
  }

  function update(profileId) {
    const profile = resolveProfile(profileId);
    const status = inspect(profileId);
    if (status.state === "installed") return status;
    if (status.state !== "outdated") {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Cursor MCP target is not managed");
    }
    const receiptResult = readReceipt(profileId, profile);
    const config = readConfig();
    if (!sameEntry(config.servers[profile.serverId], receiptResult.receipt.entry)) {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "Cursor MCP entry was modified");
    }
    const before = config.text;
    const after = replaceConfig(config, profile, normalizedEntry(profile.entry));
    try {
      writeReceipt(profileId, profile, receiptResult.receipt);
    } catch (error) {
      restoreConfig(before, after);
      throw error;
    }
    return inspect(profileId);
  }

  function repair(profileId) {
    const profile = resolveProfile(profileId);
    const status = inspect(profileId);
    if (["installed", "outdated"].includes(status.state)) return update(profileId);
    if (status.state !== "stale") {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Cursor MCP target is not managed");
    }
    const receiptResult = readReceipt(profileId, profile);
    const config = readConfig();
    if (Object.hasOwn(config.servers, profile.serverId)) {
      throw runtimeError("EXTENSION_TARGET_EXISTS", "Cursor MCP target exists externally");
    }
    const before = config.text;
    const after = replaceConfig(config, profile, normalizedEntry(profile.entry));
    try {
      writeReceipt(profileId, profile, receiptResult.receipt);
    } catch (error) {
      restoreConfig(before, after);
      throw error;
    }
    return inspect(profileId);
  }

  function uninstall(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") {
      const status = inspect(profileId);
      if (status.state === "not-installed") return status;
      throw runtimeError("EXTENSION_NOT_MANAGED", "Cursor MCP target is not managed");
    }
    if (receiptResult.state !== "valid") {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Cursor MCP receipt is invalid");
    }
    const config = readConfig();
    const existing = config.servers[profile.serverId];
    if (existing === undefined) {
      fsApi.unlinkSync(receiptPath(profileId));
      return { state: "not-installed", managed: false };
    }
    if (!sameEntry(existing, receiptResult.receipt.entry)) {
      throw runtimeError(
        "EXTENSION_CONTENT_MODIFIED",
        "Cursor MCP entry changed; nothing was removed"
      );
    }
    const before = config.text;
    const after = replaceConfig(config, profile, undefined);
    try {
      fsApi.unlinkSync(receiptPath(profileId));
    } catch (error) {
      restoreConfig(before, after);
      throw error;
    }
    return { state: "not-installed", managed: false };
  }

  function execute(profileId, action) {
    switch (action) {
      case "install": return install(profileId);
      case "update": return update(profileId);
      case "repair": return repair(profileId);
      case "uninstall": return uninstall(profileId);
      default:
        throw runtimeError("EXTENSION_ACTION_NOT_APPROVED", "Action is not approved");
    }
  }

  return Object.freeze({ inspect, execute, install, update, repair, uninstall });
}

module.exports = {
  createCursorMcpRuntime,
  normalizedEntry,
  parseConfig
};
