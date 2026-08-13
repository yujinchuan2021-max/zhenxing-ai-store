"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  ABSENT_RUNTIME_CONTRACT,
  SERVICE_NAMES,
  SERVICE_SPECS
} = require("./local-service-release-policy.cjs");

const REVISION = /^[a-f0-9]{40}$/;
const VERSION = /^(?:0|[1-9]\d*)\.\d+\.\d+$/;
const TRANSACTION_ID = /^[a-f0-9]{32}$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const IMAGE_NAME = /^[a-z0-9][a-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/;
const PHASES = new Set(["begun", "staged", "promoted", "rolled-back"]);

function exactKeys(value, names) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    Object.keys(value).every((name) => names.includes(name))
  );
}

function validateServiceEntry(entry, transactionId) {
  const fields = [
    "service",
    "liveImageName",
    "previousImageId",
    "previousImageName",
    "previousContainerId",
    "previousRuntimeContract",
    "wasRunning",
    "backupTag",
    "candidateTag",
    "candidateImageId",
    "candidateVerified"
  ];
  const spec = SERVICE_SPECS[entry?.service];
  const expectedBackup = `aihub-local-release-backup:${transactionId}-${entry?.service}`;
  const expectedCandidate = `aihub-local-release-candidate:${transactionId}-${entry?.service}`;
  if (
    !exactKeys(entry, fields) ||
    !spec ||
    entry.liveImageName !== spec.liveImageName ||
    (entry.previousImageId !== "" && !IMAGE_ID.test(entry.previousImageId)) ||
    (entry.previousContainerId !== "" &&
      !/^[a-f0-9]{64}$/.test(entry.previousContainerId)) ||
    (entry.previousContainerId !== "" && entry.previousImageId === "") ||
    !IMAGE_NAME.test(entry.previousImageName || "") ||
    typeof entry.previousRuntimeContract !== "string" ||
    entry.previousRuntimeContract.length > 96 ||
    (entry.previousImageId === "" &&
      entry.previousRuntimeContract !== ABSENT_RUNTIME_CONTRACT) ||
    (entry.previousImageId !== "" &&
      entry.previousRuntimeContract === ABSENT_RUNTIME_CONTRACT) ||
    typeof entry.wasRunning !== "boolean" ||
    (entry.wasRunning && entry.previousContainerId === "") ||
    entry.backupTag !== expectedBackup ||
    entry.candidateTag !== expectedCandidate ||
    (entry.candidateImageId !== "" && !IMAGE_ID.test(entry.candidateImageId)) ||
    typeof entry.candidateVerified !== "boolean" ||
    entry.candidateVerified !== Boolean(entry.candidateImageId)
  ) {
    throw new Error("Local service image transaction entry is invalid");
  }
  return Object.freeze({ ...entry });
}

function validateLocalServiceImageReceipt(value) {
  const fields = [
    "schemaVersion",
    "transactionId",
    "createdAt",
    "expectedRevision",
    "expectedVersion",
    "phase",
    "services"
  ];
  if (
    !exactKeys(value, fields) ||
    value.schemaVersion !== 2 ||
    !TRANSACTION_ID.test(value.transactionId || "") ||
    Number.isNaN(Date.parse(value.createdAt || "")) ||
    !REVISION.test(value.expectedRevision || "") ||
    !VERSION.test(value.expectedVersion || "") ||
    !PHASES.has(value.phase) ||
    !Array.isArray(value.services) ||
    value.services.length !== SERVICE_NAMES.length
  ) {
    throw new Error("Local service image transaction receipt is invalid");
  }
  const services = value.services.map((entry) =>
    validateServiceEntry(entry, value.transactionId)
  );
  if (services.some((entry, index) => entry.service !== SERVICE_NAMES[index])) {
    throw new Error("Local service image transaction service order is invalid");
  }
  const verified = services.every((entry) => entry.candidateVerified);
  if (
    ((value.phase === "staged" || value.phase === "promoted") && !verified) ||
    (value.phase === "begun" && verified)
  ) {
    throw new Error("Local service image transaction phase is inconsistent");
  }
  return Object.freeze({
    ...value,
    services: Object.freeze(services)
  });
}

function trustedReceiptPath(receiptPath) {
  if (typeof receiptPath !== "string" || !path.isAbsolute(receiptPath)) {
    throw new Error("Local service image receipt path must be absolute");
  }
  const resolved = path.resolve(receiptPath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 256 * 1024) {
    throw new Error("Local service image receipt is not a trusted file");
  }
  return resolved;
}

function readLocalServiceImageReceipt(receiptPath) {
  const resolved = trustedReceiptPath(receiptPath);
  return validateLocalServiceImageReceipt(
    JSON.parse(fs.readFileSync(resolved, "utf8"))
  );
}

function replaceReceiptAtomic(receiptPath, receipt) {
  const resolved = trustedReceiptPath(receiptPath);
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${crypto.randomUUID()}.tmp`
  );
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return readLocalServiceImageReceipt(resolved);
}

function markLocalServiceImagesStaged(receiptPath, candidates) {
  const receipt = readLocalServiceImageReceipt(receiptPath);
  if (!Array.isArray(candidates) || candidates.length !== SERVICE_NAMES.length) {
    throw new Error("Local service candidate image set is invalid");
  }
  const candidateMap = new Map();
  for (const candidate of candidates) {
    if (
      !exactKeys(candidate, ["service", "candidateTag", "imageId"]) ||
      !SERVICE_SPECS[candidate.service] ||
      !IMAGE_ID.test(candidate.imageId || "") ||
      candidateMap.has(candidate.service)
    ) {
      throw new Error("Local service candidate image set is invalid");
    }
    candidateMap.set(candidate.service, candidate);
  }
  const services = receipt.services.map((entry) => {
    const candidate = candidateMap.get(entry.service);
    if (!candidate || candidate.candidateTag !== entry.candidateTag) {
      throw new Error("Local service candidate tag differs from its receipt");
    }
    if (
      receipt.phase === "staged" &&
      entry.candidateImageId !== candidate.imageId
    ) {
      throw new Error("Local service staged image identity changed");
    }
    return {
      ...entry,
      candidateImageId: candidate.imageId,
      candidateVerified: true
    };
  });
  if (!new Set(["begun", "staged"]).has(receipt.phase)) {
    throw new Error("Local service image transaction cannot be staged now");
  }
  return replaceReceiptAtomic(receiptPath, {
    ...receipt,
    phase: "staged",
    services
  });
}

function markLocalServiceImagesPromoted(receiptPath) {
  const receipt = readLocalServiceImageReceipt(receiptPath);
  if (receipt.phase !== "staged") {
    throw new Error("Only a staged local service image set can be promoted");
  }
  return replaceReceiptAtomic(receiptPath, { ...receipt, phase: "promoted" });
}

function markLocalServiceImagesRolledBack(receiptPath) {
  const receipt = readLocalServiceImageReceipt(receiptPath);
  if (receipt.phase === "rolled-back") return receipt;
  return replaceReceiptAtomic(receiptPath, { ...receipt, phase: "rolled-back" });
}

module.exports = {
  markLocalServiceImagesPromoted,
  markLocalServiceImagesRolledBack,
  markLocalServiceImagesStaged,
  readLocalServiceImageReceipt,
  validateLocalServiceImageReceipt
};
