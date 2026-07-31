"use strict";

const PRESENCE_EVIDENCE_POLICIES = Object.freeze([
  "trusted-install-identity",
  "discovery"
]);

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
  PRESENCE_EVIDENCE_POLICIES,
  resolveDesktopPresence
};
