"use strict";

const crypto = require("node:crypto");

const RETIRED_CATALOG_KEY_ID = "catalog-c800e177147d63ec";
const RETIRED_PUBLIC_KEY_FINGERPRINT_SHA256 = "c800e177147d63ecf38a261ae283e69adb39d8084993953418003715f3e529c4";
const RETIRED_AT = "2026-08-12T01:18:40.527Z";
const RETIRED_SHA256 = "da5aad41bd9a2f0fe1db2045b2bf93064af7a7b171ddf9c8ca54e17e8889cb3e";
const DENYLIST_SHA256 = "06621440c2011b1d6a7d504e819d778de01f25af054d6c1e52dce49a9a1d708e";
const IDENTITY_APPROVAL_SHA256 = "5bf56e1826c6f9c7aca91d1c30415159684e6b4499559588a9579d8c359fb5b4";
const CATALOG_KEY_OPERATIONS = Object.freeze([
  "trust",
  "sign",
  "package",
  "publish",
  "upload",
  "deploy",
  "state-write"
]);
const OPERATION_SET = new Set(CATALOG_KEY_OPERATIONS);
const OBSOLETE_PUBLIC_CANDIDATES = Object.freeze([
  Object.freeze({
    artifactClass: "client-trust-transition-candidate",
    sha256: "4e69e32443bda1ba97f66ea244ded2b1bbd5a24de3b2a9bfe3e3ada8f06f01cf",
    status: "obsolete-denied"
  }),
  Object.freeze({
    artifactClass: "client-trust-new-only-candidate",
    sha256: "df135669fb8a2ae43d2ad6696402ee771db61bbabd393e1dd1d53b74ff64f399",
    status: "obsolete-denied"
  })
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    Object.keys(value).every((key) => expected.includes(key))
  );
}

function assertCatalogSigningKeyAllowed(keyId, operation) {
  if (!OPERATION_SET.has(operation)) throw new Error("CATALOG_KEY_OPERATION_INVALID");
  if (keyId === RETIRED_CATALOG_KEY_ID) throw new Error("CATALOG_KEY_RETIRED");
  return true;
}

function assertCatalogTrustedKeysAllowed(trustedKeys) {
  if (!Array.isArray(trustedKeys)) throw new Error("CATALOG_KEY_TRUST_INVALID");
  for (const entry of trustedKeys) assertCatalogSigningKeyAllowed(entry?.keyId, "trust");
  return true;
}

function invalidEvidence() {
  throw new Error("CATALOG_KEY_RETIREMENT_EVIDENCE_INVALID");
}

function validateCatalogKeyRetirementEvidence({ retiredBytes, denylistBytes, protectedContentReadCount }) {
  if (!Buffer.isBuffer(retiredBytes) || !Buffer.isBuffer(denylistBytes) || !Number.isSafeInteger(protectedContentReadCount) || protectedContentReadCount !== 0) {
    return invalidEvidence();
  }
  let retired;
  let denylist;
  try {
    retired = JSON.parse(retiredBytes.toString("utf8"));
    denylist = JSON.parse(denylistBytes.toString("utf8"));
  } catch {
    return invalidEvidence();
  }
  const serialized = `${JSON.stringify(retired)}${JSON.stringify(denylist)}`;
  if (/private(?:Key)?(?:Path|Sha|Digest)|catalog-signing-private|[\\/]private[\\/]/i.test(serialized)) return invalidEvidence();
  if (
    sha256(retiredBytes) !== RETIRED_SHA256 ||
    !exactKeys(retired, [
      "schemaVersion", "keyId", "publicKeyFingerprintSha256", "retirementClass", "reasonClass", "status", "retiredAt",
      "chainOfCustodyValid", "cryptographicCompromiseConfirmed", "identityClass", "productionReleaseIdentitySidApproved",
      "priorEffects", "privateEvidenceExcluded", "remainingGate"
    ]) ||
    retired.schemaVersion !== 1 ||
    retired.keyId !== RETIRED_CATALOG_KEY_ID ||
    retired.publicKeyFingerprintSha256 !== RETIRED_PUBLIC_KEY_FINGERPRINT_SHA256 ||
    retired.retirementClass !== "RETIRED_BEFORE_USE" ||
    retired.reasonClass !== "PRIVATE_READ_BOUNDARY_VIOLATION" ||
    retired.status !== "permanently-denied" ||
    retired.retiredAt !== RETIRED_AT ||
    retired.chainOfCustodyValid !== false ||
    retired.cryptographicCompromiseConfirmed !== false ||
    retired.identityClass !== "current-windows-production-release-signing-identity" ||
    retired.productionReleaseIdentitySidApproved !== true ||
    !exactKeys(retired.priorEffects, ["v8Signed", "packaged", "published", "deployed", "stateWritten"]) ||
    Object.values(retired.priorEffects).some((value) => value !== false) ||
    retired.privateEvidenceExcluded !== true ||
    retired.remainingGate !== "CTO_AUDIT_PASS_REQUIRED_BEFORE_NEW_KEY_GENERATION"
  ) return invalidEvidence();
  if (
    sha256(denylistBytes) !== DENYLIST_SHA256 ||
    !exactKeys(denylist, [
      "schemaVersion", "keyId", "publicKeyFingerprintSha256", "retirementClass", "reasonClass", "status", "retiredAt",
      "deniedOperations", "obsoletePublicCandidates", "sourceBindings", "futureCandidateRule", "privateEvidenceExcluded"
    ]) ||
    denylist.schemaVersion !== 1 ||
    denylist.keyId !== RETIRED_CATALOG_KEY_ID ||
    denylist.publicKeyFingerprintSha256 !== RETIRED_PUBLIC_KEY_FINGERPRINT_SHA256 ||
    denylist.retirementClass !== "RETIRED_BEFORE_USE" ||
    denylist.reasonClass !== "PRIVATE_READ_BOUNDARY_VIOLATION" ||
    denylist.status !== "permanently-denied" ||
    denylist.retiredAt !== RETIRED_AT ||
    JSON.stringify(denylist.deniedOperations) !== JSON.stringify(CATALOG_KEY_OPERATIONS) ||
    JSON.stringify(denylist.obsoletePublicCandidates) !== JSON.stringify(OBSOLETE_PUBLIC_CANDIDATES) ||
    !exactKeys(denylist.sourceBindings, ["candidateReportSha256", "identityApprovalSha256"]) ||
    denylist.sourceBindings.candidateReportSha256 !== "fe49c0f82edcf384fba10d9b1766c3e37a88ff00c1c2051355e7cf4dd76fa0f4" ||
    denylist.sourceBindings.identityApprovalSha256 !== IDENTITY_APPROVAL_SHA256 ||
    denylist.futureCandidateRule !== "reject-key-id-before-private-key-load-or-artifact-read" ||
    denylist.privateEvidenceExcluded !== true
  ) return invalidEvidence();
  return Object.freeze({
    retired,
    denylist,
    retiredSha256: RETIRED_SHA256,
    denylistSha256: DENYLIST_SHA256,
    protectedContentReadCount
  });
}

module.exports = {
  CATALOG_KEY_OPERATIONS,
  RETIRED_CATALOG_KEY_ID,
  assertCatalogSigningKeyAllowed,
  assertCatalogTrustedKeysAllowed,
  validateCatalogKeyRetirementEvidence
};
