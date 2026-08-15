"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const {
  findTrustedProductExecutable,
  pathIsInside,
  registryInstallLocation,
  resolveTrustedUninstallAction
} = require("./windows-uninstall.cjs");

const DRIVER = "registry-desktop";
const SCHEMA_VERSION = 1;
const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const MANAGEMENT_ID = /^[0-9a-f]{48}$/;
const REGISTRY_KEY = /^HKEY_(?:LOCAL_MACHINE|CURRENT_USER)\\SOFTWARE\\(?:WOW6432NODE\\)?MICROSOFT\\WINDOWS\\CURRENTVERSION\\UNINSTALL\\[^\\\0\r\n]+$/i;

const PENDING_FIELDS = Object.freeze([
  "schemaVersion",
  "driver",
  "productId",
  "adapterId",
  "executionContractSha256",
  "operationId",
  "startedAt",
  "deadlineAt",
  "registryKeys"
]);
const RECEIPT_FIELDS = Object.freeze([
  "schemaVersion",
  "driver",
  "productId",
  "adapterId",
  "executionContractSha256",
  "operationId",
  "registryKey",
  "installLocation",
  "executable",
  "uninstall",
  "displayName",
  "displayVersion",
  "publisher",
  "managementId",
  "installedAt"
]);
const UNINSTALL_FIELDS = Object.freeze(["kind", "executable", "args"]);

function exactFields(value, fields) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...fields].sort().join("\0")
  );
}

function validId(value) {
  return typeof value === "string" && ID.test(value);
}

function validIsoDate(value) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function canonicalRegistryKey(value) {
  const key = String(value || "").trim().replaceAll("/", "\\");
  return REGISTRY_KEY.test(key) ? key.toUpperCase() : "";
}

function registryKeys(registry) {
  if (!Array.isArray(registry)) return null;
  const keys = registry.map((entry) => canonicalRegistryKey(entry?.key));
  if (keys.some((key) => !key)) return null;
  return [...new Set(keys)].sort();
}

function normalizedPath(value) {
  const candidate = String(value || "").trim().replace(/^"|"$/g, "");
  if (!/^[a-z]:\\/i.test(candidate)) return "";
  return path.win32.resolve(candidate).replace(/[\\/]+$/, "");
}

function canonicalPath(value, exists, realpath) {
  const candidate = normalizedPath(value);
  if (!candidate || typeof exists !== "function" || typeof realpath !== "function") {
    return "";
  }
  try {
    if (!exists(candidate)) return "";
    return normalizedPath(realpath(candidate));
  } catch {
    return "";
  }
}

function samePath(left, right) {
  return (
    normalizedPath(left).toLowerCase() === normalizedPath(right).toLowerCase()
  );
}

function validText(value, maximum, allowEmpty = false) {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    !/[\0\r\n]/.test(value) &&
    (allowEmpty || value.trim().length > 0)
  );
}

function validUninstall(value) {
  return (
    exactFields(value, UNINSTALL_FIELDS) &&
    ["executable", "msi"].includes(value.kind) &&
    Boolean(normalizedPath(value.executable)) &&
    Array.isArray(value.args) &&
    value.args.length <= 16 &&
    value.args.every((argument) => validText(argument, 512, true))
  );
}

function isManagedRegistryPending(value) {
  return (
    exactFields(value, PENDING_FIELDS) &&
    value.schemaVersion === SCHEMA_VERSION &&
    value.driver === DRIVER &&
    validId(value.productId) &&
    validId(value.adapterId) &&
    SHA256.test(value.executionContractSha256) &&
    validId(value.operationId) &&
    validIsoDate(value.startedAt) &&
    validIsoDate(value.deadlineAt) &&
    Date.parse(value.deadlineAt) > Date.parse(value.startedAt) &&
    Array.isArray(value.registryKeys) &&
    value.registryKeys.every(
      (key, index) =>
        canonicalRegistryKey(key) === key &&
        (index === 0 || value.registryKeys[index - 1] < key)
    )
  );
}

function isManagedRegistryReceipt(value) {
  return (
    exactFields(value, RECEIPT_FIELDS) &&
    value.schemaVersion === SCHEMA_VERSION &&
    value.driver === DRIVER &&
    validId(value.productId) &&
    validId(value.adapterId) &&
    SHA256.test(value.executionContractSha256) &&
    validId(value.operationId) &&
    canonicalRegistryKey(value.registryKey) === value.registryKey &&
    Boolean(normalizedPath(value.installLocation)) &&
    Boolean(normalizedPath(value.executable)) &&
    validUninstall(value.uninstall) &&
    validText(value.displayName, 512) &&
    validText(value.displayVersion, 256, true) &&
    validText(value.publisher, 512) &&
    MANAGEMENT_ID.test(value.managementId) &&
    validIsoDate(value.installedAt)
  );
}

function parseJson(json, validator) {
  try {
    const value = JSON.parse(json);
    return validator(value) ? value : null;
  } catch {
    return null;
  }
}

function parseManagedRegistryPendingJson(json) {
  return parseJson(json, isManagedRegistryPending);
}

function parseManagedRegistryReceiptJson(json) {
  return parseJson(json, isManagedRegistryReceipt);
}

function createPendingBaseline({
  productId,
  adapterId,
  executionContractSha256,
  operationId,
  startedAt,
  deadlineAt,
  registry
}) {
  const keys = registryKeys(registry);
  const pending = {
    schemaVersion: SCHEMA_VERSION,
    driver: DRIVER,
    productId,
    adapterId,
    executionContractSha256: String(executionContractSha256 || "").toLowerCase(),
    operationId,
    startedAt,
    deadlineAt,
    registryKeys: keys
  };
  return keys && isManagedRegistryPending(pending) ? pending : null;
}

function contextMatches(value, context) {
  return (
    value.productId === context.productId &&
    value.adapterId === context.adapterId &&
    value.executionContractSha256 === context.executionContractSha256 &&
    value.operationId === context.operationId
  );
}

function trustedCandidate({ entry, adapter, exists, realpath }) {
  const action = resolveTrustedUninstallAction({
    entry,
    policy: adapter?.uninstall,
    exists,
    realpath
  });
  const installLocation = canonicalPath(
    registryInstallLocation(entry),
    exists,
    realpath
  );
  const executable = findTrustedProductExecutable({
    entry,
    executableNames: adapter?.executableNames,
    exists,
    realpath
  });
  if (
    !action ||
    !installLocation ||
    !executable ||
    !pathIsInside(executable, installLocation) ||
    !pathIsInside(action.executable, installLocation)
  ) {
    return null;
  }
  return { entry, action, installLocation, executable };
}

function signaturePassed(result) {
  return result === true || result?.ok === true;
}

async function createReceiptFromTransition({
  pending,
  productId,
  adapterId,
  executionContractSha256,
  operationId,
  adapter,
  registry,
  exists,
  realpath,
  verifySignature,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes
}) {
  const context = {
    productId,
    adapterId,
    executionContractSha256: String(executionContractSha256 || "").toLowerCase(),
    operationId
  };
  const installedAt = now();
  const currentTime = Date.parse(installedAt);
  const currentKeys = registryKeys(registry);
  if (
    !isManagedRegistryPending(pending) ||
    !contextMatches(pending, context) ||
    !validIsoDate(installedAt) ||
    currentTime < Date.parse(pending.startedAt) ||
    currentTime > Date.parse(pending.deadlineAt) ||
    !currentKeys ||
    !(adapter?.signer instanceof RegExp) ||
    !adapter?.uninstall ||
    !Array.isArray(adapter?.executableNames) ||
    typeof verifySignature !== "function"
  ) {
    return null;
  }

  const baseline = new Set(pending.registryKeys);
  const candidates = registry
    .filter((entry) => !baseline.has(canonicalRegistryKey(entry.key)))
    .map((entry) => trustedCandidate({ entry, adapter, exists, realpath }))
    .filter(Boolean);
  if (candidates.length !== 1) return null;

  const candidate = candidates[0];
  let executableSignature;
  let uninstallSignature;
  try {
    [executableSignature, uninstallSignature] = await Promise.all([
      verifySignature(candidate.executable, adapter.signer),
      verifySignature(candidate.action.executable, adapter.signer)
    ]);
  } catch {
    return null;
  }
  if (!signaturePassed(executableSignature) || !signaturePassed(uninstallSignature)) {
    return null;
  }

  let managementId = "";
  try {
    managementId = randomBytes(24).toString("hex");
  } catch {
    return null;
  }
  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    driver: DRIVER,
    ...context,
    registryKey: canonicalRegistryKey(candidate.entry.key),
    installLocation: candidate.installLocation,
    executable: candidate.executable,
    uninstall: {
      kind: candidate.action.kind,
      executable: candidate.action.executable,
      args: [...candidate.action.args]
    },
    displayName: String(candidate.entry.displayname || ""),
    displayVersion: String(candidate.entry.displayversion || ""),
    publisher: String(candidate.entry.publisher || ""),
    managementId,
    installedAt
  };
  return isManagedRegistryReceipt(receipt) ? receipt : null;
}

function mismatchStatus() {
  return {
    installed: false,
    version: "",
    location: "",
    executable: "",
    appId: "",
    canOpen: false,
    canUninstall: false,
    uninstallMode: "interactive",
    detection: "unknown",
    managed: false,
    ownership: "mismatch"
  };
}

function absentStatus() {
  return {
    installed: false,
    version: "",
    location: "",
    executable: "",
    appId: "",
    canOpen: false,
    canUninstall: false,
    uninstallMode: "interactive",
    detection: "absent",
    managed: true,
    ownership: "managed-missing"
  };
}

function removalPendingStatus() {
  return {
    ...mismatchStatus(),
    managed: true,
    ownership: "managed-removal-pending"
  };
}

async function inspectReceipt({
  receipt,
  productId,
  adapterId,
  executionContractSha256,
  adapter,
  registry,
  exists,
  realpath,
  verifySignature
}) {
  const context = {
    productId,
    adapterId,
    executionContractSha256: String(executionContractSha256 || "").toLowerCase(),
    operationId: receipt?.operationId
  };
  if (
    !isManagedRegistryReceipt(receipt) ||
    !contextMatches(receipt, context) ||
    !Array.isArray(registry) ||
    !(adapter?.signer instanceof RegExp) ||
    typeof verifySignature !== "function"
  ) {
    return mismatchStatus();
  }
  const exactEntries = registry.filter(
    (entry) => canonicalRegistryKey(entry?.key) === receipt.registryKey
  );
  if (exactEntries.length === 0) {
    try {
      return exists(receipt.executable)
        ? removalPendingStatus()
        : absentStatus();
    } catch {
      return removalPendingStatus();
    }
  }
  if (exactEntries.length !== 1) return mismatchStatus();
  const candidate = trustedCandidate({
    entry: exactEntries[0],
    adapter,
    exists,
    realpath
  });
  if (
    !candidate ||
    candidate.entry.displayname !== receipt.displayName ||
    String(candidate.entry.displayversion || "") !== receipt.displayVersion ||
    candidate.entry.publisher !== receipt.publisher ||
    !samePath(candidate.installLocation, receipt.installLocation) ||
    !samePath(candidate.executable, receipt.executable) ||
    candidate.action.kind !== receipt.uninstall.kind ||
    !samePath(candidate.action.executable, receipt.uninstall.executable) ||
    JSON.stringify(candidate.action.args) !== JSON.stringify(receipt.uninstall.args)
  ) {
    return mismatchStatus();
  }
  let executableSignature;
  let uninstallSignature;
  try {
    [executableSignature, uninstallSignature] = await Promise.all([
      verifySignature(candidate.executable, adapter.signer),
      verifySignature(candidate.action.executable, adapter.signer)
    ]);
  } catch {
    return mismatchStatus();
  }
  if (!signaturePassed(executableSignature) || !signaturePassed(uninstallSignature)) {
    return mismatchStatus();
  }
  return {
    installed: true,
    version: receipt.displayVersion,
    location: receipt.installLocation,
    executable: receipt.executable,
    appId: "",
    canOpen: true,
    canUninstall: true,
    uninstallMode: "interactive",
    detection: "installed",
    managed: true,
    ownership: "managed",
    uninstallAction: {
      kind: receipt.uninstall.kind,
      executable: receipt.uninstall.executable,
      args: [...receipt.uninstall.args]
    }
  };
}

module.exports = {
  createPendingBaseline,
  createReceiptFromTransition,
  inspectReceipt,
  isManagedRegistryPending,
  isManagedRegistryReceipt,
  parseManagedRegistryPendingJson,
  parseManagedRegistryReceiptJson
};
