"use strict";

const PRESENCE_EVIDENCE_POLICIES = Object.freeze([
  "trusted-install-identity",
  "discovery"
]);

function matchesDesktopIdentity(names, value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (!candidate || !Array.isArray(names)) return false;
  return names.some(
    (name) =>
      typeof name === "string" &&
      name.trim() &&
      candidate === name.trim().toLowerCase()
  );
}

function selectTrustedDesktopRegistryMatch({
  uninstallPolicy,
  uninstallRecord
}) {
  // A display name by itself is discovery metadata, not an install identity.
  // Reviewed desktop products may only use a registry entry after the local
  // uninstall policy has validated its publisher, command and location.
  return uninstallPolicy ? uninstallRecord?.entry || null : null;
}

function bindRegistryEvidenceToAuthenticode({
  registryMatch,
  executableSignature
}) {
  return registryMatch && executableSignature?.ok === true
    ? registryMatch
    : null;
}

function signatureInspectionIsConclusive(value) {
  return ["Valid", "NotSigned", "HashMismatch", "NotTrusted"].includes(
    value?.status
  );
}

function resolveDesktopLegacyMigration({
  currentInstalled,
  legacyInstallId,
  legacyRegistryMatched,
  legacyExecutableSignature
}) {
  return currentInstalled !== true &&
    typeof legacyInstallId === "string" &&
    legacyInstallId.length > 0 &&
    legacyRegistryMatched === true &&
    legacyExecutableSignature?.ok === true
    ? legacyInstallId
    : "";
}

function resolveDesktopPresence({
  evidencePolicy,
  registryMatched,
  packageMatched,
  startMatched,
  registryScanSucceeded,
  windowsAppsScanSucceeded
}) {
  if (!PRESENCE_EVIDENCE_POLICIES.includes(evidencePolicy)) {
    throw new TypeError("桌面产品安装证据策略无效");
  }
  const installed =
    evidencePolicy === "trusted-install-identity"
      ? Boolean(registryMatched || packageMatched)
      : Boolean(registryMatched || packageMatched || startMatched);
  return {
    installed,
    detection: installed
      ? "installed"
      : registryScanSucceeded && windowsAppsScanSucceeded
        ? "absent"
        : "unknown"
  };
}

module.exports = {
  bindRegistryEvidenceToAuthenticode,
  matchesDesktopIdentity,
  PRESENCE_EVIDENCE_POLICIES,
  resolveDesktopLegacyMigration,
  resolveDesktopPresence,
  signatureInspectionIsConclusive,
  selectTrustedDesktopRegistryMatch
};
