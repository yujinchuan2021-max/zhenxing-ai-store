"use strict";

const WINDOWS_PACKAGE_MANAGER_OPERATIONS = Object.freeze([
  "list",
  "install",
  "reinstall",
  "upgrade",
  "uninstall"
]);
const WINDOWS_PACKAGE_MANAGER_SOURCES = Object.freeze(["winget", "msstore"]);
const WINDOWS_PACKAGE_MANAGER_RECEIPT_SCHEMA_VERSION = 1;

const PACKAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,254}$/;
const PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MICROSOFT_STORE_PRODUCT_ID_PATTERN = /^(?:9[A-Z0-9]{11}|XP[A-Z0-9]{12})$/i;

function validateWindowsPackageManagerPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("Windows package-manager plan must be an object");
  }
  if (plan.driver !== "winget") {
    throw new Error("Windows package-manager driver must be winget");
  }
  if (!WINDOWS_PACKAGE_MANAGER_SOURCES.includes(plan.source)) {
    throw new Error("Windows package-manager source is not approved");
  }
  if (
    typeof plan.packageId !== "string" ||
    plan.packageId !== plan.packageId.trim() ||
    !PACKAGE_ID_PATTERN.test(plan.packageId)
  ) {
    throw new Error("Windows package-manager packageId is invalid");
  }

  return Object.freeze({
    driver: "winget",
    source: plan.source,
    packageId: plan.packageId
  });
}

function wingetListAllArgs() {
  return Object.freeze([
    "list",
    "--accept-source-agreements",
    "--disable-interactivity"
  ]);
}

function wingetArgsFor(operation, plan) {
  if (!WINDOWS_PACKAGE_MANAGER_OPERATIONS.includes(operation)) {
    throw new Error(`Unsupported winget operation: ${operation}`);
  }
  const { packageId, source } = validateWindowsPackageManagerPlan(plan);
  const command = operation === "reinstall" ? "install" : operation;
  const args = [command, "--id", packageId, "--exact", "--source", source];

  if (operation === "list") {
    return Object.freeze([
      ...args,
      "--accept-source-agreements",
      "--disable-interactivity"
    ]);
  }
  if (operation === "uninstall") {
    return Object.freeze([
      ...args,
      "--interactive",
      "--disable-interactivity"
    ]);
  }
  return Object.freeze([
    ...args,
    ...(operation === "reinstall" ? ["--force"] : []),
    "--interactive",
    "--accept-package-agreements",
    "--accept-source-agreements",
    "--disable-interactivity"
  ]);
}

function cleanWingetOutput(output) {
  return String(output || "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "\n");
}

function looksLikeVersion(value) {
  return /^(?:unknown|v?\d+(?:[._+-][A-Za-z0-9]+)*)$/i.test(value || "");
}

function parseWingetListOutput(output) {
  const lines = cleanWingetOutput(output).split("\n");
  const dividerIndex = lines.findIndex((line) => /^-{6,}$/.test(line.trim()));
  if (dividerIndex < 1) return [];

  const rows = [];
  for (const line of lines.slice(dividerIndex + 1)) {
    if (!line.trim()) continue;
    const values = line.trim().split(/\s+/);
    let source = "";
    if (/^(?:winget|msstore)$/i.test(values.at(-1) || "")) {
      source = values.pop();
    }
    const packageIndex = values.findIndex(
      (value, index) =>
        index > 0 &&
        (value.includes(".") || MICROSOFT_STORE_PRODUCT_ID_PATTERN.test(value)) &&
        PACKAGE_ID_PATTERN.test(value) &&
        looksLikeVersion(values[index + 1])
    );
    if (packageIndex < 1) continue;
    const name = values.slice(0, packageIndex).join(" ");
    const packageId = values[packageIndex];
    const version = values[packageIndex + 1];
    rows.push(
      Object.freeze({
        name,
        packageId,
        version,
        availableVersion: values[packageIndex + 2] || "",
        source
      })
    );
  }
  return rows;
}

function findWingetListEntry(output, packageId) {
  if (typeof packageId !== "string" || !PACKAGE_ID_PATTERN.test(packageId)) {
    throw new Error("Windows package-manager packageId is invalid");
  }
  const expected = packageId.toLowerCase();
  return (
    parseWingetListOutput(output).find(
      (entry) => entry.packageId.toLowerCase() === expected
    ) || null
  );
}

function normalizeWindowsPackageManagerReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new TypeError("Windows package-manager receipt must be an object");
  }
  if (receipt.schemaVersion !== WINDOWS_PACKAGE_MANAGER_RECEIPT_SCHEMA_VERSION) {
    throw new Error("Windows package-manager receipt schema is invalid");
  }
  if (
    typeof receipt.productId !== "string" ||
    !PRODUCT_ID_PATTERN.test(receipt.productId)
  ) {
    throw new Error("Windows package-manager receipt productId is invalid");
  }
  const plan = validateWindowsPackageManagerPlan(receipt);
  if (
    typeof receipt.installedVersion !== "string" ||
    receipt.installedVersion.length > 128 ||
    typeof receipt.installedAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.installedAt))
  ) {
    throw new Error("Windows package-manager receipt metadata is invalid");
  }
  return Object.freeze({
    schemaVersion: WINDOWS_PACKAGE_MANAGER_RECEIPT_SCHEMA_VERSION,
    productId: receipt.productId,
    ...plan,
    installedVersion: receipt.installedVersion,
    installedAt: receipt.installedAt
  });
}

function createWindowsPackageManagerReceipt({
  productId,
  plan,
  installedVersion = "",
  installedAt = new Date().toISOString()
}) {
  return normalizeWindowsPackageManagerReceipt({
    schemaVersion: WINDOWS_PACKAGE_MANAGER_RECEIPT_SCHEMA_VERSION,
    productId,
    ...validateWindowsPackageManagerPlan(plan),
    installedVersion: String(installedVersion || ""),
    installedAt
  });
}

function parseWindowsPackageManagerReceiptJson(text) {
  return normalizeWindowsPackageManagerReceipt(JSON.parse(String(text)));
}

function windowsPackageManagerReceiptMatches(receipt, productId, plan) {
  try {
    const normalized = normalizeWindowsPackageManagerReceipt(receipt);
    const expected = validateWindowsPackageManagerPlan(plan);
    return (
      normalized.productId === productId &&
      normalized.driver === expected.driver &&
      normalized.source === expected.source &&
      normalized.packageId.toLowerCase() === expected.packageId.toLowerCase()
    );
  } catch {
    return false;
  }
}

module.exports = {
  WINDOWS_PACKAGE_MANAGER_RECEIPT_SCHEMA_VERSION,
  WINDOWS_PACKAGE_MANAGER_OPERATIONS,
  WINDOWS_PACKAGE_MANAGER_SOURCES,
  createWindowsPackageManagerReceipt,
  findWingetListEntry,
  parseWingetListOutput,
  parseWindowsPackageManagerReceiptJson,
  validateWindowsPackageManagerPlan,
  windowsPackageManagerReceiptMatches,
  wingetArgsFor,
  wingetListAllArgs
};
