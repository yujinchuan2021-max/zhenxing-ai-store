"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RECEIPT_SCHEMA_VERSION = 1;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SERVER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
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

function assertProfile(profile) {
  if (
    !isRecord(profile) ||
    profile.adapterId !== "codex-mcp-toml" ||
    typeof profile.extensionId !== "string" ||
    !profile.extensionId ||
    typeof profile.hostProductId !== "string" ||
    !profile.hostProductId ||
    !SERVER_ID.test(profile.serverId || "") ||
    typeof profile.versionRef !== "string" ||
    !profile.versionRef ||
    !isRecord(profile.entry) ||
    Object.keys(profile.entry).some((key) => !["url"].includes(key))
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Codex MCP profile");
  }
  let endpoint;
  try {
    endpoint = new URL(profile.entry.url);
  } catch {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Codex MCP URL");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Unsafe Codex MCP URL");
  }
  return profile;
}

function quoteToml(value) {
  return JSON.stringify(value);
}

function marker(profileId, edge) {
  return `# ZHENXING-AI:${edge}:${profileId}`;
}

function managedBlock(profileId, profile, enabled) {
  return [
    marker(profileId, "BEGIN"),
    `[mcp_servers.${profile.serverId}]`,
    `url = ${quoteToml(profile.entry.url)}`,
    `enabled = ${enabled ? "true" : "false"}`,
    marker(profileId, "END")
  ].join("\n");
}

function locateManagedBlock(text, profileId) {
  const begin = marker(profileId, "BEGIN");
  const end = marker(profileId, "END");
  const start = text.indexOf(begin);
  const endStart = text.indexOf(end);
  if (start < 0 && endStart < 0) return null;
  if (
    start < 0 ||
    endStart < start ||
    text.indexOf(begin, start + begin.length) >= 0 ||
    text.indexOf(end, endStart + end.length) >= 0
  ) {
    return { invalid: true };
  }
  let finish = endStart + end.length;
  if (text.slice(finish, finish + 2) === "\r\n") finish += 2;
  else if (text[finish] === "\n") finish += 1;
  return { start, finish, block: text.slice(start, endStart + end.length) };
}

function hasExternalServerTable(text, serverId, managedRange = null) {
  const escaped = serverId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s*\\[\\s*mcp_servers\\.(?:${escaped}|"${escaped}")\\s*\\]\\s*(?:#.*)?$`,
    "gm"
  );
  let match;
  while ((match = pattern.exec(text))) {
    if (
      !managedRange ||
      match.index < managedRange.start ||
      match.index >= managedRange.finish
    ) {
      return true;
    }
  }
  return false;
}

function readSmallFile(filePath, maximumBytes, fsApi = fs) {
  if (!fsApi.existsSync(filePath)) return null;
  const stat = fsApi.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > maximumBytes) {
    throw runtimeError("EXTENSION_CONFIG_UNSAFE", "Unsafe extension config file");
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

function writeAtomic(filePath, text, expectedText, fsApi = fs) {
  const current = readSmallFile(filePath, MAX_CONFIG_BYTES, fsApi);
  if ((current || "") !== (expectedText || "")) {
    throw runtimeError("EXTENSION_CONFIG_CHANGED", "Host config changed during operation");
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

function appendBlock(text, block) {
  const normalized = text || "";
  const separator = normalized.length === 0
    ? ""
    : normalized.endsWith("\n\n")
      ? ""
      : normalized.endsWith("\n")
        ? "\n"
        : "\n\n";
  return {
    text: `${normalized}${separator}${block}\n`,
    separatorLength: separator.length
  };
}

function createCodexMcpRuntime({
  configPath,
  receiptsRoot,
  fsApi = fs,
  profileLookup,
  now = () => new Date().toISOString()
}) {
  if (
    typeof configPath !== "string" ||
    !path.isAbsolute(configPath) ||
    typeof receiptsRoot !== "string" ||
    !path.isAbsolute(receiptsRoot) ||
    typeof profileLookup !== "function"
  ) {
    throw new TypeError("Codex MCP runtime options are invalid");
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
    const filePath = receiptPath(profileId);
    let text;
    try {
      text = readSmallFile(filePath, MAX_RECEIPT_BYTES, fsApi);
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
        receipt.serverId !== profile.serverId ||
        typeof receipt.versionRef !== "string" ||
        typeof receipt.enabled !== "boolean" ||
        !Number.isSafeInteger(receipt.separatorLength) ||
        receipt.separatorLength < 0 ||
        receipt.separatorLength > 2 ||
        !SHA256.test(receipt.blockSha256 || "") ||
        typeof receipt.installedAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.installedAt))
      ) {
        return { state: "invalid", receipt: null };
      }
      return { state: "valid", receipt };
    } catch {
      return { state: "invalid", receipt: null };
    }
  }

  function writeReceipt(profileId, profile, enabled, separatorLength) {
    ensureSafeDirectory(receiptsRoot, fsApi);
    const block = managedBlock(profileId, profile, enabled);
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      profileId,
      adapterId: profile.adapterId,
      extensionId: profile.extensionId,
      hostProductId: profile.hostProductId,
      serverId: profile.serverId,
      versionRef: profile.versionRef,
      enabled,
      separatorLength,
      blockSha256: digest(block),
      installedAt: now()
    };
    const filePath = receiptPath(profileId);
    const previous = readSmallFile(filePath, MAX_RECEIPT_BYTES, fsApi);
    writeAtomic(filePath, `${JSON.stringify(receipt, null, 2)}\n`, previous, fsApi);
    return receipt;
  }

  function inspect(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") {
      return { state: "invalid-receipt", managed: false };
    }
    let config;
    try {
      config = readSmallFile(configPath, MAX_CONFIG_BYTES, fsApi) || "";
    } catch {
      return { state: "unsafe", managed: false };
    }
    const range = locateManagedBlock(config, profileId);
    if (range?.invalid) return { state: "unsafe", managed: false };
    const external = hasExternalServerTable(config, profile.serverId, range);
    if (receiptResult.state === "missing") {
      return {
        state: range || external ? "external" : "not-installed",
        managed: false
      };
    }
    if (!range) return { state: "stale", managed: false };
    if (external) return { state: "modified", managed: false };
    const enabledBlock = managedBlock(profileId, profile, true);
    const disabledBlock = managedBlock(profileId, profile, false);
    const enabled = range.block === enabledBlock
      ? true
      : range.block === disabledBlock
        ? false
        : null;
    if (enabled === null || digest(range.block) !== receiptResult.receipt.blockSha256) {
      return { state: "modified", managed: false };
    }
    if (receiptResult.receipt.versionRef !== profile.versionRef) {
      return { state: "outdated", managed: true, enabled };
    }
    return {
      state: enabled ? "installed" : "disabled",
      managed: true,
      enabled
    };
  }

  function install(profileId) {
    const profile = resolveProfile(profileId);
    const status = inspect(profileId);
    if (["installed", "disabled", "outdated"].includes(status.state)) return status;
    if (status.state !== "not-installed") {
      throw runtimeError("EXTENSION_TARGET_EXISTS", "MCP target is already owned externally");
    }
    const before = readSmallFile(configPath, MAX_CONFIG_BYTES, fsApi) || "";
    const block = managedBlock(profileId, profile, true);
    const appended = appendBlock(before, block);
    writeAtomic(configPath, appended.text, before, fsApi);
    try {
      writeReceipt(profileId, profile, true, appended.separatorLength);
    } catch (error) {
      try { writeAtomic(configPath, before, appended.text, fsApi); } catch {}
      throw error;
    }
    return inspect(profileId);
  }

  function replaceManagedBlock(profileId, action, enabled) {
    const profile = resolveProfile(profileId);
    const status = inspect(profileId);
    if (status.state === "modified" || status.state === "unsafe") {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "Managed MCP entry was modified");
    }
    if (action === "repair" && status.state === "stale") {
      const before = readSmallFile(configPath, MAX_CONFIG_BYTES, fsApi) || "";
      if (hasExternalServerTable(before, profile.serverId)) {
        throw runtimeError("EXTENSION_TARGET_EXISTS", "MCP target is externally configured");
      }
      const block = managedBlock(profileId, profile, true);
      const appended = appendBlock(before, block);
      writeAtomic(configPath, appended.text, before, fsApi);
      try {
        writeReceipt(profileId, profile, true, appended.separatorLength);
      } catch (error) {
        try { writeAtomic(configPath, before, appended.text, fsApi); } catch {}
        throw error;
      }
      return inspect(profileId);
    }
    if (!["installed", "disabled", "outdated"].includes(status.state)) {
      throw runtimeError("EXTENSION_NOT_MANAGED", "MCP target is not managed");
    }
    const before = readSmallFile(configPath, MAX_CONFIG_BYTES, fsApi) || "";
    const range = locateManagedBlock(before, profileId);
    if (!range || range.invalid) {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "Managed MCP entry was modified");
    }
    const nextEnabled = enabled === undefined ? status.enabled !== false : enabled;
    const nextBlock = managedBlock(profileId, profile, nextEnabled);
    const after = `${before.slice(0, range.start)}${nextBlock}${before.slice(range.finish - (before[range.finish - 1] === "\n" ? 1 : 0))}`;
    writeAtomic(configPath, after, before, fsApi);
    const receipt = readReceipt(profileId, profile);
    try {
      writeReceipt(
        profileId,
        profile,
        nextEnabled,
        receipt.state === "valid" ? receipt.receipt.separatorLength : 0
      );
    } catch (error) {
      try { writeAtomic(configPath, before, after, fsApi); } catch {}
      throw error;
    }
    return inspect(profileId);
  }

  function uninstall(profileId) {
    const profile = resolveProfile(profileId);
    const receipt = readReceipt(profileId, profile);
    if (receipt.state === "missing") return { state: "not-installed", managed: false };
    if (receipt.state !== "valid") {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "MCP receipt is invalid");
    }
    const status = inspect(profileId);
    if (status.state === "stale") {
      fsApi.unlinkSync(receiptPath(profileId));
      return { state: "not-installed", managed: false };
    }
    if (!["installed", "disabled", "outdated"].includes(status.state)) {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "MCP entry changed; nothing was removed");
    }
    const before = readSmallFile(configPath, MAX_CONFIG_BYTES, fsApi) || "";
    const range = locateManagedBlock(before, profileId);
    if (!range || range.invalid) {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "MCP entry changed; nothing was removed");
    }
    const removeStart = range.start - receipt.receipt.separatorLength;
    if (
      removeStart < 0 ||
      before.slice(removeStart, range.start) !== "\n".repeat(receipt.receipt.separatorLength)
    ) {
      throw runtimeError("EXTENSION_CONTENT_MODIFIED", "MCP entry boundary changed; nothing was removed");
    }
    let after = `${before.slice(0, removeStart)}${before.slice(range.finish)}`;
    after = after.replace(/\n{3,}$/u, "\n\n");
    writeAtomic(configPath, after, before, fsApi);
    fsApi.unlinkSync(receiptPath(profileId));
    return { state: "not-installed", managed: false };
  }

  function execute(profileId, action) {
    switch (action) {
      case "install": return install(profileId);
      case "update": return replaceManagedBlock(profileId, "update");
      case "repair": return replaceManagedBlock(profileId, "repair");
      case "enable": return replaceManagedBlock(profileId, "enable", true);
      case "disable": return replaceManagedBlock(profileId, "disable", false);
      case "uninstall": return uninstall(profileId);
      default: throw runtimeError("EXTENSION_ACTION_NOT_APPROVED", "Action is not approved");
    }
  }

  return Object.freeze({ inspect, execute, getStatus: inspect, install, uninstall });
}

module.exports = {
  createCodexMcpRuntime,
  hasExternalServerTable,
  locateManagedBlock,
  managedBlock
};
