"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { INSTALL_MODES, INSTALL_REGISTRY, cliInstallPlans } = require("./install-registry.cjs");
const { CLI_DRIVER_IDS, driverIdForPlan } = require("./cli-driver-registry.cjs");
const {
  artifactFor,
  createManagedBinaryLayout,
  inspectManagedBinaryCli
} = require("./managed-binary-cli.cjs");
const {
  cleanupInterruptedPortableFiles,
  replaceManagedPortableFiles,
  uninstallManagedPortableFiles
} = require("./managed-portable-files.cjs");

const MAX_INPUT_BYTES = 128 * 1024;
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const OPERATIONS = new Set(["install", "update", "repair", "uninstall"]);
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const FORBIDDEN = new Set([
  "__proto__", "prototype", "constructor", "command", "args", "env", "headers",
  "credentials", "token", "secret", "script", "url", "path", "executable"
]);

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(value, fields) {
  return plain(value) && Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field));
}

function timestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function safeInput(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value !== "object") return true;
  if (depth > 32 || seen.has(value) || (!Array.isArray(value) && !plain(value))) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key) || !safeInput(child, seen, depth + 1)) return false;
  }
  seen.delete(value);
  return true;
}

function input(value, fields) {
  if (!exact(value, fields) || !safeInput(value)) throw new TypeError("CLI lifecycle input is invalid");
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > MAX_INPUT_BYTES) throw new RangeError("CLI lifecycle input is too large");
  return value;
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function validReceipt(receipt) {
  return plain(receipt) && typeof receipt.receiptId === "string" && ID.test(receipt.receiptId) &&
    receipt.revokedAt === null;
}

function receiptSummary(receipt, action, persisted) {
  return freeze({
    ownership: "aihub",
    action,
    persisted,
    receiptId: typeof receipt?.receiptId === "string" ? receipt.receiptId : null,
    version: typeof receipt?.version === "string" ? receipt.version : ""
  });
}

function receiptOwnsPortableBinaryPlan({
  productId,
  plan,
  receipt,
  installRoot,
  architecture = process.arch,
  fileSystem = fs,
  hashFile
}) {
  if (!validReceipt(receipt)) return false;
  const status = inspectManagedBinaryCli({
    productId,
    plan,
    receipt,
    configuredPrefix: installRoot,
    architecture,
    verifyIntegrity: true,
    fileSystem,
    hashFile
  });
  return status?.installed === true && status.managed === true && status.ownership === "managed";
}

function portableBinaryMarker(receipt) {
  return JSON.stringify({
    driver: receipt.driver,
    productId: receipt.productId,
    version: receipt.version,
    architecture: receipt.architecture,
    integrityAlgorithm: receipt.integrityAlgorithm,
    integrity: receipt.integrity,
    managementId: receipt.managementId
  }, null, 2);
}

function createPortableBinaryLifecycleExecutor({
  installRoot,
  artifactProvider,
  receiptStore,
  architecture = process.arch,
  fileSystem = fs,
  hashFile,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes,
  randomId = crypto.randomUUID,
  makeReceiptId = crypto.randomUUID
} = {}) {
  if (
    typeof installRoot !== "string" ||
    typeof artifactProvider !== "function" ||
    !receiptStore ||
    typeof receiptStore.read !== "function" ||
    typeof receiptStore.write !== "function" ||
    typeof receiptStore.remove !== "function" ||
    typeof architecture !== "string" ||
    typeof hashFile !== "function" ||
    typeof now !== "function" ||
    typeof randomBytes !== "function" ||
    typeof randomId !== "function" ||
    typeof makeReceiptId !== "function"
  ) {
    throw new TypeError("Portable binary lifecycle executor options are invalid");
  }

  const readStoredReceipt = (productId) => receiptStore.read(productId) || null;
  const restoreStoredReceipt = async (productId, previous) => {
    if (previous) await receiptStore.write(productId, previous);
    else await receiptStore.remove(productId);
  };
  const recheck = ({ productId, plan, receipt }) => inspectManagedBinaryCli({
    productId,
    plan,
    receipt,
    configuredPrefix: installRoot,
    architecture,
    verifyIntegrity: true,
    fileSystem,
    hashFile
  });

  async function applyFixedPlan({ productId, profileId, moduleId, operation, plan, receipt }) {
    const layout = createManagedBinaryLayout({ productId, plan, prefix: installRoot, architecture });
    const artifact = artifactFor(plan, architecture);
    if (
      moduleId !== "cli-managed" ||
      driverIdForPlan(plan) !== "portable-binary" ||
      !layout ||
      !artifact ||
      path.win32.basename(artifact.executableFileName) !== artifact.executableFileName
    ) {
      return freeze({ ok: false, error: "PORTABLE_BINARY_EXECUTOR_UNAVAILABLE", rollback: { restored: true } });
    }
    const priorManaged = operation !== "install";
    const previousReceipt = readStoredReceipt(productId);
    if (priorManaged && (!validReceipt(receipt) || receipt?.receiptId !== previousReceipt?.receiptId ||
        receiptOwnsPortableBinaryPlan({ productId, plan, receipt, installRoot, architecture, fileSystem, hashFile }) !== true)) {
      return freeze({ ok: false, error: "OWNED_RECEIPT_REQUIRED", rollback: { restored: true } });
    }
    try {
      fileSystem.mkdirSync(layout.directory, { recursive: true });
      cleanupInterruptedPortableFiles({
        directory: layout.directory,
        executableFileName: path.win32.basename(layout.executable),
        markerFileName: path.win32.basename(layout.marker),
        fileSystem
      });
      if (operation === "uninstall") {
        await uninstallManagedPortableFiles({
          directory: layout.directory,
          executableFileName: path.win32.basename(layout.executable),
          markerFileName: path.win32.basename(layout.marker),
          removeReceipt: async () => receiptStore.remove(productId),
          restoreReceipt: async () => restoreStoredReceipt(productId, previousReceipt),
          fileSystem,
          randomId
        });
        return freeze({
          ok: true,
          status: recheck({ productId, plan, receipt: null }),
          receipt: null,
          rollback: { restored: false }
        });
      }
      const installedAt = String(now());
      const managementId = randomBytes(24).toString("hex");
      const nextReceipt = freeze({
        receiptId: String(makeReceiptId()),
        profileId,
        moduleId,
        revokedAt: null,
        driver: "portable-binary",
        productId,
        version: layout.version,
        architecture,
        prefix: layout.prefix,
        directory: layout.directory,
        executable: layout.executable,
        integrityAlgorithm: artifact.integrityAlgorithm,
        integrity: artifact.integrity,
        managementId,
        installedAt
      });
      if (!ID.test(nextReceipt.receiptId) || !MANAGEMENT_ID.test(managementId) || !timestamp(installedAt)) {
        return freeze({ ok: false, error: "RECEIPT_INVALID", rollback: { restored: true } });
      }
      await replaceManagedPortableFiles({
        directory: layout.directory,
        executableFileName: path.win32.basename(layout.executable),
        markerFileName: path.win32.basename(layout.marker),
        markerContents: portableBinaryMarker(nextReceipt),
        priorManaged,
        stageExecutable: async (target) => {
          const source = await artifactProvider({ productId, profileId, artifact });
          if (!source || typeof source !== "object" || typeof source.filePath !== "string") {
            throw new Error("fixture artifact unavailable");
          }
          fileSystem.copyFileSync(source.filePath, target);
        },
        validateStagedExecutable: async (target) => {
          if (hashFile(target, artifact.integrityAlgorithm) !== artifact.integrity) {
            throw new Error("fixture artifact integrity mismatch");
          }
        },
        writeReceipt: async () => receiptStore.write(productId, nextReceipt),
        restoreReceipt: async () => restoreStoredReceipt(productId, previousReceipt),
        fileSystem,
        randomId
      });
      const status = recheck({ productId, plan, receipt: nextReceipt });
      if (!status.installed || !status.managed) throw new Error("portable binary recheck failed");
      return freeze({
        ok: true,
        status,
        receipt: nextReceipt,
        rollback: { restored: false }
      });
    } catch (error) {
      const restoredReceipt = readStoredReceipt(productId);
      const status = recheck({ productId, plan, receipt: restoredReceipt });
      return freeze({
        ok: false,
        error: error?.code === "PORTABLE_FILE_ROLLBACK_FAILED" ? "ROLLBACK_FAILED" : "APPLY_FAILED",
        status,
        rollback: { restored: error?.code !== "PORTABLE_FILE_ROLLBACK_FAILED" }
      });
    }
  }

  return Object.freeze({ applyFixedPlan });
}

function createManagedCliLifecycleCandidate({
  registrations = INSTALL_REGISTRY,
  plans = cliInstallPlans(),
  readReceipt = async () => null,
  receiptOwnsPlan = () => false,
  verifyUserConfirmation = async () => false,
  executor = null,
  now = () => new Date().toISOString(),
  makeId = crypto.randomUUID
} = {}) {
  if (!plain(registrations) || !plain(plans) || typeof readReceipt !== "function" ||
      typeof receiptOwnsPlan !== "function" || typeof verifyUserConfirmation !== "function" ||
      (executor !== null && typeof executor?.applyFixedPlan !== "function") ||
      typeof now !== "function" || typeof makeId !== "function") {
    throw new TypeError("CLI lifecycle candidate options are invalid");
  }
  const records = new Map();

  function result(ok, value) {
    return freeze(ok ? { ok: true, value } : { ok: false, error: value });
  }

  function registrationFor(productId, operation) {
    const registration = registrations[productId];
    const plan = plans[productId];
    const driver = driverIdForPlan(plan);
    return registration?.mode === INSTALL_MODES.MANAGED_CLI && registration.kind === "CLI" &&
      registration.productType === "cli" && plan && CLI_DRIVER_IDS.includes(driver) &&
      Array.isArray(registration.capabilities) && registration.capabilities.includes(operation)
      ? { registration, plan, driver }
      : null;
  }

  async function plan(request) {
    try {
      input(request, ["productId", "operation", "useId"]);
      if (![request.productId, request.useId].every((value) => typeof value === "string" && ID.test(value)) ||
          !OPERATIONS.has(request.operation)) throw new TypeError("CLI lifecycle input is invalid");
    } catch (cause) {
      return result(false, cause instanceof RangeError ? "INPUT_TOO_LARGE" : "INPUT_INVALID");
    }
    const fixed = registrationFor(request.productId, request.operation);
    if (!fixed) return result(false, "FIXED_PROFILE_UNAVAILABLE");
    const receipt = await readReceipt({ productId: request.productId }).catch(() => null);
    const needsReceipt = request.operation !== "install";
    if (needsReceipt && (!validReceipt(receipt) || receiptOwnsPlan({ productId: request.productId, plan: fixed.plan, receipt }) !== true)) {
      return result(false, "OWNED_RECEIPT_REQUIRED");
    }
    const planId = String(makeId());
    const createdAt = String(now());
    if (!ID.test(planId) || !timestamp(createdAt)) return result(false, "LIFECYCLE_UNAVAILABLE");
    if (records.size >= 256) records.delete(records.keys().next().value);
    const entry = freeze({
      planId,
      productId: request.productId,
      profileId: fixed.registration.profileId,
      moduleId: fixed.registration.moduleId,
      operation: request.operation,
      useId: request.useId,
      driver: fixed.driver,
      receiptId: receipt?.receiptId || null,
      createdAt,
      confirmationId: null
    });
    records.set(planId, entry);
    return result(true, freeze({
      planId,
      productId: entry.productId,
      profileId: entry.profileId,
      moduleId: entry.moduleId,
      operation: entry.operation,
      driver: entry.driver,
      requirements: [...fixed.registration.requirements],
      receiptRequired: needsReceipt,
      rollbackRequired: request.operation !== "uninstall",
      state: "confirmation-required"
    }));
  }

  async function confirm(request) {
    try {
      input(request, ["planId", "useId", "confirmationId"]);
      if (![request.planId, request.useId, request.confirmationId].every((value) => typeof value === "string" && ID.test(value))) {
        throw new TypeError("CLI lifecycle input is invalid");
      }
    } catch (cause) {
      return result(false, cause instanceof RangeError ? "INPUT_TOO_LARGE" : "INPUT_INVALID");
    }
    const entry = records.get(request.planId);
    if (!entry || entry.useId !== request.useId || entry.confirmationId !== null) return result(false, "CONFIRMATION_NOT_ALLOWED");
    const approved = await verifyUserConfirmation({
      planId: entry.planId,
      productId: entry.productId,
      profileId: entry.profileId,
      operation: entry.operation,
      useId: entry.useId,
      confirmationId: request.confirmationId
    }).catch(() => false);
    if (approved !== true) return result(false, "USER_CONFIRMATION_REQUIRED");
    records.set(entry.planId, freeze({ ...entry, confirmationId: request.confirmationId }));
    return result(true, freeze({ planId: entry.planId, confirmationId: request.confirmationId, state: "confirmed" }));
  }

  async function apply(request) {
    try {
      input(request, ["planId", "useId", "confirmationId", "dryRun"]);
      if (![request.planId, request.useId, request.confirmationId].every((value) => typeof value === "string" && ID.test(value)) ||
          typeof request.dryRun !== "boolean") throw new TypeError("CLI lifecycle input is invalid");
    } catch (cause) {
      return result(false, cause instanceof RangeError ? "INPUT_TOO_LARGE" : "INPUT_INVALID");
    }
    const entry = records.get(request.planId);
    if (!entry || entry.useId !== request.useId || entry.confirmationId !== request.confirmationId) {
      return result(false, "CONFIRMATION_REQUIRED");
    }
    const age = Date.parse(String(now())) - Date.parse(entry.createdAt);
    if (!Number.isFinite(age) || age < 0 || age > CONFIRMATION_TTL_MS) return result(false, "CONFIRMATION_EXPIRED");
    const fixed = registrationFor(entry.productId, entry.operation);
    if (!fixed) return result(false, "FIXED_PROFILE_UNAVAILABLE");
    const receipt = await readReceipt({ productId: entry.productId }).catch(() => null);
    if (entry.operation !== "install" && (!validReceipt(receipt) || receipt?.receiptId !== entry.receiptId ||
        receiptOwnsPlan({ productId: entry.productId, plan: fixed.plan, receipt }) !== true)) {
      return result(false, "OWNED_RECEIPT_REVOKED");
    }
    if (request.dryRun) return result(true, freeze({
      planId: entry.planId,
      state: "dry-run",
      receipt: receiptSummary(receipt, entry.operation, false),
      rollback: { required: entry.operation !== "uninstall", executed: false }
    }));
    if (!executor) return result(false, "FIXED_EXECUTOR_UNAVAILABLE");
    const applied = await executor.applyFixedPlan({
      productId: entry.productId,
      profileId: entry.profileId,
      moduleId: entry.moduleId,
      operation: entry.operation,
      plan: fixed.plan,
      receipt
    }).catch(() => null);
    if (!plain(applied) || typeof applied.ok !== "boolean") return result(false, "FIXED_EXECUTOR_FAILED");
    return applied.ok === true
      ? result(true, freeze({
          planId: entry.planId,
          state: "applied",
          receipt: receiptSummary(applied.receipt, entry.operation, entry.operation !== "uninstall"),
          status: applied.status || null,
          rollback: { required: entry.operation !== "uninstall", executed: false }
        }))
      : result(false, applied.rollback?.restored === true ? "APPLY_FAILED_ROLLED_BACK" : "APPLY_FAILED");
  }

  return Object.freeze({ plan, confirm, apply });
}

module.exports = {
  createManagedCliLifecycleCandidate,
  createPortableBinaryLifecycleExecutor,
  receiptOwnsPortableBinaryPlan
};
