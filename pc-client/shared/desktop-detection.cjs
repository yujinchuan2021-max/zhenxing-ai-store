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
  matchesDesktopIdentity,
  PRESENCE_EVIDENCE_POLICIES,
  resolveDesktopPresence
};
