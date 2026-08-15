"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RECEIPT_SCHEMA_VERSION = 1;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_RECEIPT_BYTES = 64 * 1024;
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;

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
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Claude MCP entry");
  }
  let endpoint;
  try {
    endpoint = new URL(value.url);
  } catch {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Claude MCP URL");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Unsafe Claude MCP URL");
  }
  return Object.freeze({ url: endpoint.href });
}

function assertProfile(profile) {
  if (
    !isRecord(profile) ||
    ["command", "args", "env", "headers"].some((field) =>
      Object.hasOwn(profile, field)
    ) ||
    profile.adapterId !== "claude-code-mcp-cli" ||
    typeof profile.extensionId !== "string" ||
    !profile.extensionId ||
    profile.hostProductId !== "claude-code" ||
    profile.scope !== "user" ||
    !SAFE_ID.test(profile.serverId || "") ||
    typeof profile.versionRef !== "string" ||
    !profile.versionRef ||
    profile.versionRef.length > 256
  ) {
    throw runtimeError("EXTENSION_PROFILE_INVALID", "Invalid Claude MCP profile");
  }
  normalizedEntry(profile.entry);
  return profile;
}

function ensureSafeDirectory(directory, fsApi = fs) {
  if (!path.isAbsolute(directory) || path.parse(directory).root === path.resolve(directory)) {
    throw runtimeError("EXTENSION_RECEIPT_INVALID", "Unsafe MCP receipt root");
  }
  const root = path.parse(directory).root;
  let current = root;
  for (const segment of path.relative(root, directory).split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    if (!fsApi.existsSync(current)) break;
    const stat = fsApi.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Unsafe MCP receipt root");
    }
  }
  fsApi.mkdirSync(directory, { recursive: true });
}

function readSmallFile(filePath, fsApi = fs) {
  if (!fsApi.existsSync(filePath)) return null;
  const stat = fsApi.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_RECEIPT_BYTES) {
    throw runtimeError("EXTENSION_RECEIPT_INVALID", "MCP receipt is invalid");
  }
  return fsApi.readFileSync(filePath, "utf8");
}

function writeAtomic(filePath, text, expectedText, fsApi = fs) {
  const current = readSmallFile(filePath, fsApi);
  if ((current || "") !== (expectedText || "")) {
    throw runtimeError(
      "EXTENSION_CONFIG_CHANGED",
      "MCP receipt changed during operation"
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

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function listHasServer(stdout, serverId) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > MAX_COMMAND_OUTPUT) {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Claude MCP response is invalid");
  }
  const escaped = serverId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[^A-Za-z0-9_-])${escaped}(?:$|[^A-Za-z0-9_-])`,
    "mi"
  ).test(stripAnsi(stdout));
}

function getMatchesEntry(stdout, entry) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > MAX_COMMAND_OUTPUT) {
    throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Claude MCP response is invalid");
  }
  const clean = stripAnsi(stdout);
  return /(^|\n)\s*Scope:\s*User(?:\s|$)/i.test(clean) && clean.includes(entry.url);
}

function addArgs(profile, entry = normalizedEntry(profile.entry)) {
  return [
    "mcp",
    "add",
    "--transport",
    "http",
    "--scope",
    "user",
    profile.serverId,
    entry.url
  ];
}

function removeArgs(profile) {
  return ["mcp", "remove", profile.serverId, "--scope", "user"];
}

function createClaudeCodeMcpRuntime({
  receiptsRoot,
  profileLookup,
  resolveHostExecutable,
  runHostCommand,
  fsApi = fs,
  now = () => new Date().toISOString()
}) {
  if (
    typeof receiptsRoot !== "string" ||
    !path.isAbsolute(receiptsRoot) ||
    typeof profileLookup !== "function" ||
    typeof resolveHostExecutable !== "function" ||
    typeof runHostCommand !== "function"
  ) {
    throw new TypeError("Claude Code MCP runtime options are invalid");
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
      text = readSmallFile(receiptPath(profileId), fsApi);
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
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Claude MCP receipt is invalid");
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
      fsApi
    );
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

  async function command(executable, args, allowFailure = false) {
    let result;
    try {
      result = await runHostCommand({ executable, args: [...args] });
    } catch {
      throw runtimeError("EXTENSION_HOST_COMMAND_FAILED", "Claude MCP command failed");
    }
    if (
      !isRecord(result) ||
      typeof result.ok !== "boolean" ||
      typeof result.stdout !== "string" ||
      Buffer.byteLength(result.stdout, "utf8") > MAX_COMMAND_OUTPUT
    ) {
      throw runtimeError("EXTENSION_HOST_RESPONSE_INVALID", "Claude MCP response is invalid");
    }
    if (!result.ok && !allowFailure) {
      throw runtimeError("EXTENSION_HOST_COMMAND_FAILED", "Claude MCP command failed");
    }
    return result;
  }

  async function query(executable, profile) {
    const details = await command(
      executable,
      ["mcp", "get", profile.serverId],
      true
    );
    if (details.ok) {
      return {
        present: true,
        matches: getMatchesEntry(details.stdout, normalizedEntry(profile.entry))
      };
    }
    const listed = await command(executable, ["mcp", "list"]);
    if (listHasServer(listed.stdout, profile.serverId)) {
      throw runtimeError(
        "EXTENSION_HOST_RESPONSE_INVALID",
        "Claude MCP details are unavailable"
      );
    }
    return { present: false, matches: false };
  }

  async function queryReceiptEntry(executable, profile, receipt) {
    return query(executable, { ...profile, entry: receipt.entry });
  }

  async function inspect(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "invalid") {
      return { state: "invalid-receipt", managed: false };
    }
    const executable = await hostExecutable(profile);
    if (!executable) {
      return {
        state: "host-missing",
        managed: receiptResult.state === "valid"
      };
    }
    if (receiptResult.state === "missing") {
      const current = await query(executable, profile);
      return {
        state: current.present ? "external" : "not-installed",
        managed: false
      };
    }
    const owned = await queryReceiptEntry(
      executable,
      profile,
      receiptResult.receipt
    );
    if (!owned.present) return { state: "stale", managed: true };
    if (!owned.matches) return { state: "modified", managed: false };
    const currentEntry = normalizedEntry(profile.entry);
    if (
      receiptResult.receipt.versionRef !== profile.versionRef ||
      JSON.stringify(receiptResult.receipt.entry) !== JSON.stringify(currentEntry)
    ) {
      return { state: "outdated", managed: true };
    }
    return { state: "installed", managed: true };
  }

  async function addServer(executable, profile, entry) {
    await command(executable, addArgs(profile, entry));
    try {
      const current = await query(executable, { ...profile, entry });
      if (!current.present || !current.matches) {
        throw runtimeError(
          "EXTENSION_POSTCONDITION_FAILED",
          "Claude MCP installation was not confirmed"
        );
      }
    } catch (error) {
      await removeServer(executable, profile);
      throw error;
    }
  }

  async function removeServer(executable, profile) {
    await command(executable, removeArgs(profile));
  }

  async function rollbackAddedServer(executable, profile, entry) {
    await removeServer(executable, profile);
    const remaining = await query(executable, { ...profile, entry });
    if (remaining.present && remaining.matches) {
      throw runtimeError(
        "EXTENSION_ROLLBACK_FAILED",
        "Claude MCP rollback was not confirmed"
      );
    }
  }

  async function install(profileId) {
    const profile = resolveProfile(profileId);
    const status = await inspect(profileId);
    if (status.state === "installed") return status;
    if (status.state === "outdated") return update(profileId);
    if (status.state === "stale") return repair(profileId);
    if (status.state === "host-missing") {
      throw runtimeError("EXTENSION_HOST_MISSING", "Claude Code is not installed");
    }
    if (status.state !== "not-installed") {
      throw runtimeError(
        "EXTENSION_TARGET_EXISTS",
        "Claude MCP target is already owned externally"
      );
    }
    const executable = await hostExecutable(profile);
    const entry = normalizedEntry(profile.entry);
    await addServer(executable, profile, entry);
    try {
      writeReceipt(profileId, profile);
    } catch (error) {
      await rollbackAddedServer(executable, profile, entry);
      removeReceipt(profileId);
      throw error;
    }
    return inspect(profileId);
  }

  async function update(profileId) {
    const profile = resolveProfile(profileId);
    const status = await inspect(profileId);
    if (status.state === "installed") return status;
    if (status.state !== "outdated") {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Claude MCP target is not managed");
    }
    const receiptResult = readReceipt(profileId, profile);
    const executable = await hostExecutable(profile);
    const nextEntry = normalizedEntry(profile.entry);
    await removeServer(executable, profile);
    try {
      await addServer(executable, profile, nextEntry);
    } catch (error) {
      await addServer(executable, profile, receiptResult.receipt.entry);
      throw error;
    }
    try {
      writeReceipt(profileId, profile, receiptResult.receipt);
    } catch (error) {
      await removeServer(executable, profile);
      await addServer(executable, profile, receiptResult.receipt.entry);
      throw error;
    }
    return inspect(profileId);
  }

  async function repair(profileId) {
    const profile = resolveProfile(profileId);
    const status = await inspect(profileId);
    if (["installed", "outdated"].includes(status.state)) return update(profileId);
    if (status.state !== "stale") {
      throw runtimeError("EXTENSION_NOT_MANAGED", "Claude MCP target is not managed");
    }
    const receiptResult = readReceipt(profileId, profile);
    const executable = await hostExecutable(profile);
    const entry = normalizedEntry(profile.entry);
    await addServer(executable, profile, entry);
    try {
      writeReceipt(profileId, profile, receiptResult.receipt);
    } catch (error) {
      await rollbackAddedServer(executable, profile, entry);
      throw error;
    }
    return inspect(profileId);
  }

  async function uninstall(profileId) {
    const profile = resolveProfile(profileId);
    const receiptResult = readReceipt(profileId, profile);
    if (receiptResult.state === "missing") {
      const status = await inspect(profileId);
      if (status.state === "not-installed") return status;
      throw runtimeError("EXTENSION_NOT_MANAGED", "Claude MCP target is not managed");
    }
    if (receiptResult.state !== "valid") {
      throw runtimeError("EXTENSION_RECEIPT_INVALID", "Claude MCP receipt is invalid");
    }
    const executable = await hostExecutable(profile);
    if (!executable) throw runtimeError("EXTENSION_HOST_MISSING", "Claude Code is not installed");
    const owned = await queryReceiptEntry(executable, profile, receiptResult.receipt);
    if (!owned.present) {
      removeReceipt(profileId);
      return { state: "not-installed", managed: false };
    }
    if (!owned.matches) {
      throw runtimeError(
        "EXTENSION_CONTENT_MODIFIED",
        "Claude MCP entry changed; nothing was removed"
      );
    }
    await removeServer(executable, profile);
    const remaining = await queryReceiptEntry(executable, profile, receiptResult.receipt);
    if (remaining.present && remaining.matches) {
      throw runtimeError(
        "EXTENSION_POSTCONDITION_FAILED",
        "Claude MCP removal was not confirmed"
      );
    }
    removeReceipt(profileId);
    return { state: "not-installed", managed: false };
  }

  async function execute(profileId, action) {
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
  addArgs,
  createClaudeCodeMcpRuntime,
  getMatchesEntry,
  listHasServer,
  removeArgs
};
